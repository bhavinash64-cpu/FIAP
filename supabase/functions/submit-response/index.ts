// Supabase Edge Function: submit-response
//
// The single write path for anonymous public survey submissions. Direct
// anon INSERT on survey_responses/survey_answers is revoked (see
// migrations/20260714150000_analytics_and_hardening.sql) specifically so
// every public submission passes through here, where it can be rate-limited
// by a hashed IP fingerprint before it ever touches the database.
//
// Since 20260721094500_response_answer_metadata a submission also carries
// per-answer metadata — the
// emoji the respondent saw, how long they sat with the question, whether they
// skipped it, changed their mind, or had it read aloud. That migration and this
// function deploy independently, so every write here degrades to the legacy
// column set if the new columns are not present yet (see insertWithFallback).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_SECONDS_BETWEEN_SUBMISSIONS = 5 * 60; // one submission per IP per survey per 5 minutes
const MAX_SUBMISSIONS_PER_DAY = 20;
const MAX_ANSWER_COUNT = 20;
/** Metadata is recorded for every question VISITED, answered or not. */
const MAX_META_COUNT = 60;
const MAX_TEXT_ANSWER_LENGTH = 5_000;
const MAX_EMOJI_LENGTH = 16;
const MAX_SECONDS_PER_QUESTION = 86_400;

interface AnswerMeta {
  emoji?: unknown;
  seconds?: unknown;
  skipped?: unknown;
  edited?: unknown;
  voiceUsed?: unknown;
  answeredAt?: unknown;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 128_000) {
    return json({ error: "Request payload is too large" }, 413);
  }

  try {
    const body = await req.json();
    const { survey_id, language, answers, meta, started_at, question_count, answered_count } = body ?? {};

    if (!survey_id || typeof survey_id !== "string") return json({ error: "Missing survey_id" }, 400);
    // This function runs as service_role, so the client payload is untrusted:
    // reject a malformed/oversized object before anything is inserted.
    if (!isPlainObject(answers) && answers !== null && answers !== undefined) {
      return json({ error: "Invalid answers" }, 400);
    }
    if (!isPlainObject(meta) && meta !== null && meta !== undefined) {
      return json({ error: "Invalid answer metadata" }, 400);
    }

    const answerEntries = Object.entries((answers ?? {}) as Record<string, unknown>);
    const metaEntries = Object.entries((meta ?? {}) as Record<string, unknown>);
    if (answerEntries.length > MAX_ANSWER_COUNT) return json({ error: "Too many answers" }, 400);
    if (metaEntries.length > MAX_META_COUNT) return json({ error: "Too much answer metadata" }, 400);
    if (!isValidStartedAt(started_at)) return json({ error: "Invalid assessment start time" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: survey, error: sErr } = await supabase.from("surveys").select("id, status").eq("id", survey_id).maybeSingle();
    if (sErr) throw sErr;
    if (!survey) return json({ error: "Survey not found" }, 404);
    if (survey.status !== "published") return json({ error: "This survey is not currently accepting responses." }, 403);

    // Only accept answers for questions that actually belong to this survey —
    // a caller must not be able to write rows against arbitrary question ids.
    const { data: qRows, error: qErr } = await supabase.from("survey_questions").select("id").eq("survey_id", survey_id);
    if (qErr) throw qErr;
    const validQuestionIds = new Set((qRows ?? []).map((q) => q.id as string));
    const surveyQuestionCount = validQuestionIds.size;

    // The LEFTMOST X-Forwarded-For entry is whatever the client sent and is
    // trivially spoofable; each trusted proxy APPENDS, so the entry the platform
    // added last is the real client IP. Prefer a platform header, then the last
    // XFF hop — never the first.
    const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    const ip = req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || xff[xff.length - 1] || "unknown";
    const ipHash = await sha256(ip);

    const { data: accepted, error: rateError } = await supabase.rpc("claim_survey_submission_slot", {
      p_survey_id: survey_id,
      p_ip_hash: ipHash,
      p_min_interval_seconds: MIN_SECONDS_BETWEEN_SUBMISSIONS,
      p_max_per_day: MAX_SUBMISSIONS_PER_DAY,
    });
    if (rateError) throw rateError;
    if (!accepted) return json({ error: "Too many submissions from this connection. Please try again later." }, 429);

    // Counts are recomputed from the payload the server accepted, never trusted
    // from the client: a submission claiming 100% completion while carrying two
    // answers would otherwise poison every completion statistic on the platform.
    const acceptedAnswers = answerEntries.filter(
      ([qid, v]) => validQuestionIds.has(qid) && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
    );
    const serverQuestionCount = surveyQuestionCount || clampInt(question_count, 0, 1000) || null;
    const serverAnsweredCount = Math.min(acceptedAnswers.length, serverQuestionCount ?? acceptedAnswers.length);

    const startedAtIso = typeof started_at === "string" ? started_at : null;
    const durationSeconds = startedAtIso
      ? clampInt(Math.round((Date.now() - Date.parse(startedAtIso)) / 1000), 0, MAX_SECONDS_PER_QUESTION)
      : null;

    const responsePayload = {
      survey_id,
      language: typeof language === "string" ? language.slice(0, 12) : "en",
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      ip_hash: ipHash,
      started_at: startedAtIso,
    };
    const responseExtras = {
      question_count: serverQuestionCount,
      answered_count: serverAnsweredCount,
      duration_seconds: durationSeconds,
    };

    const response = await insertWithFallback(supabase, "survey_responses", [responsePayload], responseExtras, true);
    const responseId = (response as { id: string }[])[0]?.id;
    if (!responseId) throw new Error("Response row was not returned");

    // A row is written for every question the respondent VISITED, not only the
    // ones they answered: "seen and left blank" and "never reached" are
    // different facts about an instrument, and only rows can tell them apart.
    const metaById = new Map<string, AnswerMeta>(
      metaEntries.filter(([qid, m]) => validQuestionIds.has(qid) && isPlainObject(m)) as [string, AnswerMeta][],
    );
    const answerById = new Map(acceptedAnswers);

    const touchedIds = [...new Set([...answerById.keys(), ...metaById.keys()])].slice(0, MAX_META_COUNT);

    const rows = touchedIds.map((question_id) => {
      const m = metaById.get(question_id) ?? {};
      const hasValue = answerById.has(question_id);
      const value = answerById.get(question_id);

      const base: Record<string, unknown> = { response_id: responseId, question_id };
      if (hasValue) {
        // Cap sizes so a hostile payload can't write unbounded data.
        if (Array.isArray(value)) {
          base.value_json = value.slice(0, 200).filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 500));
        } else if (typeof value === "number" && Number.isFinite(value)) {
          base.value_int = value;
        } else {
          base.value_text = typeof value === "string" ? value.slice(0, MAX_TEXT_ANSWER_LENGTH) : "";
        }
      }
      return base;
    });

    const extrasByIndex = touchedIds.map((question_id) => {
      const m = metaById.get(question_id) ?? {};
      const hasValue = answerById.has(question_id);
      return {
        // The CHECK constraint forbids a value on a skipped row, so an answered
        // question is never marked skipped however the client labelled it.
        skipped: !hasValue && m.skipped === true,
        edited: m.edited === true,
        voice_used: m.voiceUsed === true,
        emoji: hasValue && typeof m.emoji === "string" && m.emoji ? m.emoji.slice(0, MAX_EMOJI_LENGTH) : null,
        seconds_spent: clampInt(m.seconds, 0, MAX_SECONDS_PER_QUESTION),
        answered_at: hasValue && isIsoWithinDay(m.answeredAt) ? (m.answeredAt as string) : null,
      };
    });

    if (rows.length) {
      await insertWithFallback(supabase, "survey_answers", rows, extrasByIndex, false);
    }

    return json({ id: responseId });
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong while submitting. Please try again." }, 500);
  }
});

/**
 * Insert with the metadata columns, falling back to the legacy column set if
 * the schema does not have them yet.
 *
 * The migration and this function ship on separate tracks: `supabase db push`
 * and `supabase functions deploy` are two commands, run in whichever order.
 * Without this, deploying the function first would reject every public
 * submission until someone noticed — the one failure mode this write path
 * exists to prevent. PostgREST reports an unknown column as PGRST204.
 */
async function insertWithFallback(
  // The Supabase client is constructed by the Deno runtime's esm import, which
  // the repo's TypeScript project never sees — there is no shared type to name.
  // deno-lint-ignore no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  table: string,
  rows: Record<string, unknown>[],
  extras: Record<string, unknown> | Record<string, unknown>[],
  returnRows: boolean,
) {
  const merged = rows.map((row, i) => ({ ...row, ...(Array.isArray(extras) ? (extras[i] ?? {}) : extras) }));

  const attempt = async (payload: Record<string, unknown>[]) => {
    const q = supabase.from(table).insert(payload);
    const { data, error } = returnRows ? await q.select("id") : await q;
    if (error) throw error;
    return data;
  };

  try {
    return await attempt(merged);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    const message = String((error as { message?: string })?.message ?? "");
    const isMissingColumn = code === "PGRST204" || /column .* does not exist|schema cache/i.test(message);
    if (!isMissingColumn) throw error;
    console.warn(
      `${table}: metadata columns absent, writing legacy row set. Apply migration ` +
        `20260721094500_response_answer_metadata.sql.`,
    );
    return await attempt(rows);
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Finite integer within bounds, or null. */
function clampInt(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, Math.round(n)));
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isIsoWithinDay(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  const now = Date.now();
  return timestamp <= now + 60_000 && timestamp >= now - 24 * 60 * 60 * 1000;
}

function isValidStartedAt(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return isIsoWithinDay(value);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
