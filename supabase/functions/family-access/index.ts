// Supabase Edge Function: family-access
//
// The ENTIRE surface a family respondent can reach. There is no other one.
//
// Respondents hold no Supabase session and no table grant — `family_cases`,
// `family_case_sessions` and the draft/answer tables revoke everything from
// anon and authenticated (see migrations/20260721090000_family_case_workflow).
// This function runs as service_role and is the only code that may touch them,
// which is what makes "the family can only see their own assessment" a
// structural fact rather than a UI convention. A respondent cannot browse
// surveys, list cases, or read another family's answers by editing a URL,
// because there is no endpoint that would let them and no credential that
// would be accepted if there were.
//
// Every action resolves an opaque session token to exactly ONE case id and
// scopes every subsequent query by it.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** A session outlives a sitting so a family can finish tomorrow, not a month later. */
const SESSION_TTL_HOURS = 72;
/** Wrong phone numbers against a real link before the case locks. */
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
/** Login attempts per connection per 15 min. Defends against blind sweeps. */
const IP_WINDOW_SECONDS = 900;
const MAX_IP_ATTEMPTS = 30;

const MAX_TEXT_ANSWER_LENGTH = 5_000;
const MAX_ANSWER_COUNT = 300;
const MAX_DRAFT_BYTES = 512_000;

type Json = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const contentLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 1_000_000) {
    return json({ error: "Request payload is too large" }, 413);
  }

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return json({ error: "Malformed request" }, 400);
  }

  const action = typeof body.action === "string" ? body.action : "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (action) {
      case "resolve":
        return await handleResolve(supabase, body);
      case "login":
        return await handleLogin(supabase, body, req);
      case "resume":
        return await handleResume(supabase, body);
      case "save":
        return await handleSave(supabase, body);
      case "submit":
        return await handleSubmit(supabase, body, req);
      case "signout":
        return await handleSignout(supabase, body);
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (e) {
    console.error(`family-access:${action}`, e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// resolve — what a QR code or secure link may reveal BEFORE sign-in
//
// Deliberately almost nothing: enough for the family to recognise that the
// link is theirs, never enough for a stranger who found the slip to learn who
// died or what the family's number is. The phone is masked to its last two
// digits, which is a memory jog for the right person and useless to anyone
// else.
// ───────────────────────────────────────────────────────────────────────────
async function handleResolve(supabase: SupabaseClient, body: Json) {
  const token = str(body.token);
  if (!token) return json({ error: "Missing link" }, 400);

  const { data: c } = await supabase
    .from("family_cases")
    .select("id, reference_id, family_head_name, phone, preferred_language, status, expires_at, scheduled_for, survey_id")
    .eq("access_token", token)
    .maybeSingle();

  if (!c) return json({ state: "not_found" });
  if (new Date(c.expires_at as string) < new Date() || c.status === "expired") {
    return json({ state: "expired" });
  }
  // Scheduled for later: a VALID slip that has simply not opened yet. Kept
  // distinct from expired and not_found so the family reads "come back on the
  // 3rd" instead of a dead end — and so the link_opened event below does not
  // fire for an assessment they cannot actually start.
  if (c.scheduled_for && new Date(c.scheduled_for as string) > new Date()) {
    return json({ state: "scheduled", opensAt: c.scheduled_for });
  }

  const { data: survey } = await supabase
    .from("surveys")
    .select("title_en, title_te")
    .eq("id", c.survey_id)
    .maybeSingle();

  // The link having been looked at is itself case progress worth recording.
  if (c.status === "not_started") {
    await supabase
      .from("family_cases")
      .update({ status: "opened", opened_at: new Date().toISOString() })
      .eq("id", c.id)
      .eq("status", "not_started");
    await logEvent(supabase, c.id as string, "link_opened", {}, "respondent");
  }

  return json({
    state: "ok",
    case: {
      referenceId: c.reference_id,
      familyHead: c.family_head_name,
      phoneHint: maskPhone(c.phone as string),
      language: c.preferred_language,
      status: c.status,
    },
    survey: { titleEn: survey?.title_en ?? "", titleTe: survey?.title_te ?? null },
  });
}

// ───────────────────────────────────────────────────────────────────────────
// login — the secure link, plus the family's own phone number
//
// The PIN is gone. The credential is now the ACCESS TOKEN in the link/QR: ~109
// bits, per case, existing only on the printed slip. The phone number confirms
// that the right family is holding the right slip.
//
// The token is therefore REQUIRED. A phone number is not a secret — it is on
// the case file, known to relatives, and a 10-digit Indian mobile is guessable
// within a district — so accepting "phone alone" here would make every
// household's answers readable to anyone willing to enumerate numbers. If a
// future change reintroduces a token-less path, that is the whole model gone.
// ───────────────────────────────────────────────────────────────────────────
async function handleLogin(supabase: SupabaseClient, body: Json, req: Request) {
  const phone = normalisePhone(str(body.phone));
  const token = str(body.token).trim();

  if (!/^\d{10}$/.test(phone) || !token) {
    return json({ error: "invalid_credentials" }, 401);
  }

  const ipHash = await sha256(clientIp(req));
  const { data: allowed, error: throttleError } = await supabase.rpc("claim_family_login_attempt", {
    p_ip_hash: ipHash,
    p_window_seconds: IP_WINDOW_SECONDS,
    p_max_attempts: MAX_IP_ATTEMPTS,
  });
  if (throttleError) throw throttleError;
  if (!allowed) return json({ error: "too_many_attempts" }, 429);

  // Resolve the case by its token, then compare the phone in constant time.
  // Filtering on the phone in SQL instead would make "no row" mean either
  // wrong-token or wrong-phone and leave nothing to charge the lockout counter
  // against — the counter has to live on a case we actually found.
  const { data: rows, error } = await supabase
    .from("family_cases")
    .select("*")
    .eq("access_token", token)
    .limit(1);
  if (error) throw error;

  const matched = (rows ?? [])[0] as FamilyCaseRow | undefined;
  if (!matched) return json({ error: "invalid_credentials" }, 401);

  const now = new Date();

  // The lockout is checked BEFORE the phone is compared, and that order is the
  // whole point of it. Checking after meant a wrong number returned 401 and
  // returned early, so the lock was only ever consulted on the path where the
  // caller had ALREADY produced the right phone — i.e. never for the attacker
  // it exists to stop. Worse, registerFailure() zeroes failed_attempts when it
  // locks, so every fifth guess reset the counter and the lock it set was never
  // read: someone holding a found slip could try numbers indefinitely, bounded
  // only by the per-IP throttle. Guessing a 10-digit Indian mobile within a
  // known district is feasible; this was the last barrier in front of one
  // household's answers.
  if (matched.locked_until && new Date(matched.locked_until) > now) {
    return json({ error: "locked", retryAt: matched.locked_until }, 423);
  }

  if (!timingSafeEqual(normalisePhone(matched.phone), phone)) {
    // Wrong number against a real link. Charge it: five of these and the case
    // locks, so someone holding a found slip cannot sit and try numbers.
    await registerFailure(supabase, matched);
    return json({ error: "invalid_credentials" }, 401);
  }
  if (matched.status === "expired" || new Date(matched.expires_at) < now) {
    return json({ error: "expired" }, 403);
  }
  // Right credentials, but the officer scheduled this one to open later. This
  // is what makes the picked date a real gate rather than a note.
  if (matched.scheduled_for && new Date(matched.scheduled_for) > now) {
    return json({ error: "not_yet_open", opensAt: matched.scheduled_for }, 403);
  }

  await supabase
    .from("family_cases")
    .update({
      failed_attempts: 0,
      locked_until: null,
      status: matched.status === "not_started" ? "opened" : matched.status,
      opened_at: matched.opened_at ?? now.toISOString(),
    })
    .eq("id", matched.id);

  const session = await issueSession(supabase, matched.id, req);
  await logEvent(supabase, matched.id, "login", {}, "respondent");

  const bundle = await buildBundle(supabase, { ...matched, status: matched.status === "not_started" ? "opened" : matched.status });
  return json({ session, ...bundle });
}

async function registerFailure(supabase: SupabaseClient, c: FamilyCaseRow) {
  const attempts = (c.failed_attempts ?? 0) + 1;
  const locked = attempts >= MAX_FAILED_ATTEMPTS;
  await supabase
    .from("family_cases")
    .update({
      failed_attempts: locked ? 0 : attempts,
      locked_until: locked ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString() : c.locked_until,
    })
    .eq("id", c.id);
  if (locked) await logEvent(supabase, c.id, "locked_out", { attempts: MAX_FAILED_ATTEMPTS }, "system");
}

// ───────────────────────────────────────────────────────────────────────────
// resume / save / submit — all scoped by the session's single case id
// ───────────────────────────────────────────────────────────────────────────
async function handleResume(supabase: SupabaseClient, body: Json) {
  const found = await requireSession(supabase, str(body.session));
  if ("error" in found) return json({ error: found.error }, found.status);
  const bundle = await buildBundle(supabase, found.case);
  return json(bundle);
}

async function handleSave(supabase: SupabaseClient, body: Json) {
  const found = await requireSession(supabase, str(body.session));
  if ("error" in found) return json({ error: found.error }, found.status);
  const c = found.case;

  if (c.status === "completed") return json({ error: "already_submitted" }, 409);

  const draft = body.draft;
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) {
    return json({ error: "Invalid draft" }, 400);
  }
  if (JSON.stringify(draft).length > MAX_DRAFT_BYTES) {
    return json({ error: "Draft too large" }, 413);
  }

  const answerCount = countAnswers((draft as Json).answers);
  const nextStatus = answerCount > 0 && (c.status === "opened" || c.status === "not_started")
    ? "in_progress"
    : c.status;

  await supabase
    .from("family_cases")
    .update({
      draft,
      draft_updated_at: new Date().toISOString(),
      status: nextStatus,
      started_at: c.started_at ?? (answerCount > 0 ? new Date().toISOString() : null),
    })
    .eq("id", c.id);

  if (nextStatus !== c.status) await logEvent(supabase, c.id, "started", {}, "respondent");

  return json({ ok: true, savedAt: new Date().toISOString(), status: nextStatus });
}

async function handleSubmit(supabase: SupabaseClient, body: Json, req: Request) {
  const found = await requireSession(supabase, str(body.session));
  if ("error" in found) return json({ error: found.error }, found.status);
  const c = found.case;

  // Idempotent on purpose: a flaky connection retrying the final POST must not
  // create a second response row for the same family.
  if (c.status === "completed" && c.response_id) {
    const { data: existing } = await supabase
      .from("survey_responses")
      .select("id, submitted_at, completion_pct")
      .eq("id", c.response_id)
      .maybeSingle();
    if (existing) {
      return json({
        referenceId: c.reference_id,
        assessmentId: formatAssessmentId(existing.id as string),
        submittedAt: existing.submitted_at,
        completionPct: existing.completion_pct ?? 100,
        alreadySubmitted: true,
      });
    }
  }

  const answers = body.answers;
  if (answers !== null && answers !== undefined && (typeof answers !== "object" || Array.isArray(answers))) {
    return json({ error: "Invalid answers" }, 400);
  }
  const answerEntries = Object.entries((answers ?? {}) as Record<string, unknown>);
  if (answerEntries.length > MAX_ANSWER_COUNT) return json({ error: "Too many answers" }, 400);

  const meta = (body.meta ?? {}) as Record<string, AnswerMetaPayload>;
  const language = str(body.language) === "te" ? "te" : "en";
  const startedAt = validStartedAt(body.startedAt);

  // Only questions belonging to THIS case's survey are accepted — a tampered
  // payload cannot write answers against another instrument.
  const { data: qRows, error: qErr } = await supabase
    .from("survey_questions")
    .select("id")
    .eq("survey_id", c.survey_id);
  if (qErr) throw qErr;
  const validQuestionIds = new Set((qRows ?? []).map((q) => q.id as string));
  const questionTotal = validQuestionIds.size;

  const now = new Date();
  const durationSeconds = startedAt
    ? Math.max(0, Math.round((now.getTime() - new Date(startedAt).getTime()) / 1000))
    : null;

  const usable = answerEntries.filter(
    ([qid, v]) => validQuestionIds.has(qid) && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0),
  );
  const answeredCount = usable.length;
  const completionPct = questionTotal ? Math.round((answeredCount / questionTotal) * 100) : 0;
  const skippedCount = Math.max(0, questionTotal - answeredCount);

  // completion_pct is GENERATED ALWAYS from these two counts (see
  // 20260721094500_response_answer_metadata.sql) — writing it directly would be
  // rejected by Postgres. The counts are the facts; the percentage derives.
  const { data: response, error: rErr } = await supabase
    .from("survey_responses")
    .insert({
      survey_id: c.survey_id,
      family_case_id: c.id,
      reference_id: c.reference_id,
      language,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
      ip_hash: await sha256(clientIp(req)),
      started_at: startedAt,
      duration_seconds: durationSeconds,
      question_count: questionTotal,
      answered_count: answeredCount,
    })
    .select("id, submitted_at, completion_pct")
    .single();
  if (rErr) throw rErr;

  const metaFor = (question_id: string) => {
    const m = meta[question_id] ?? {};
    return {
      response_id: response.id,
      question_id,
      emoji: typeof m.emoji === "string" ? m.emoji.slice(0, 16) : null,
      seconds_spent: Number.isFinite(m.seconds) ? Math.min(86_400, Math.max(0, Math.round(Number(m.seconds)))) : null,
      edited: m.edited === true,
      voice_used: m.voiceUsed === true,
      answered_at: validStartedAt(m.answeredAt),
    };
  };

  const answered = usable.map(([question_id, value]) => {
    // `skipped` is false here by definition: a row carrying a value is an
    // answer, even if the respondent skipped past it earlier and came back.
    // The schema enforces that pairing with a CHECK constraint.
    const base = { ...metaFor(question_id), skipped: false };
    if (Array.isArray(value)) {
      return {
        ...base,
        value_json: value.slice(0, 200).filter((x) => typeof x === "string").map((x) => (x as string).slice(0, 500)),
      };
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      // value_int is an integer column: a non-integral number from a tampered
      // or malformed payload would make the whole INSERT fail and lose the
      // family's entire submission, so clamp it into range rather than trust it.
      return { ...base, value_int: Math.trunc(Math.min(2_147_483_647, Math.max(-2_147_483_648, value))) };
    }
    return { ...base, value_text: typeof value === "string" ? value.slice(0, MAX_TEXT_ANSWER_LENGTH) : "" };
  });

  // A DELIBERATE skip gets a value-less row; a question never reached gets no
  // row at all. That distinction is the whole reason the metadata exists — an
  // analyst can tell refusal from attrition.
  const answeredIds = new Set(usable.map(([qid]) => qid));
  const skipped = Object.entries(meta)
    .filter(([qid, m]) => m?.skipped === true && validQuestionIds.has(qid) && !answeredIds.has(qid))
    .map(([question_id]) => ({ ...metaFor(question_id), skipped: true }));

  const rows = [...answered, ...skipped];
  if (rows.length) {
    const { error: aErr } = await supabase.from("survey_answers").insert(rows);
    if (aErr) throw aErr;
  }

  await supabase
    .from("family_cases")
    .update({
      status: "completed",
      completed_at: now.toISOString(),
      response_id: response.id,
      draft: null,
      draft_updated_at: null,
    })
    .eq("id", c.id);

  await logEvent(supabase, c.id, "submitted", { completion_pct: completionPct, answered: answeredCount }, "respondent");
  // The session has served its purpose. Revoking it here means a shared or
  // borrowed phone cannot be reopened into the family's answers afterwards.
  await supabase.from("family_case_sessions").update({ revoked_at: now.toISOString() }).eq("case_id", c.id);

  return json({
    referenceId: c.reference_id,
    assessmentId: formatAssessmentId(response.id as string),
    submittedAt: response.submitted_at,
    completionPct,
    answeredCount,
    skippedCount,
  });
}

async function handleSignout(supabase: SupabaseClient, body: Json) {
  const token = str(body.session);
  if (token) {
    await supabase
      .from("family_case_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", await sha256(token));
  }
  return json({ ok: true });
}

// ───────────────────────────────────────────────────────────────────────────
// Session handling
// ───────────────────────────────────────────────────────────────────────────
async function issueSession(supabase: SupabaseClient, caseId: string, req: Request) {
  const raw = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 3_600_000).toISOString();
  const { error } = await supabase.from("family_case_sessions").insert({
    case_id: caseId,
    token_hash: await sha256(raw),
    expires_at: expiresAt,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300),
    ip_hash: await sha256(clientIp(req)),
  });
  if (error) throw error;
  return { token: raw, expiresAt };
}

type SessionResult = { case: FamilyCaseRow } | { error: string; status: number };

async function requireSession(supabase: SupabaseClient, token: string): Promise<SessionResult> {
  if (!token) return { error: "no_session", status: 401 };

  const { data: session } = await supabase
    .from("family_case_sessions")
    .select("id, case_id, expires_at, revoked_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();

  if (!session || session.revoked_at) return { error: "no_session", status: 401 };
  if (new Date(session.expires_at as string) < new Date()) return { error: "session_expired", status: 401 };

  const { data: c } = await supabase
    .from("family_cases")
    .select("*")
    .eq("id", session.case_id)
    .maybeSingle();
  if (!c) return { error: "no_session", status: 401 };

  const row = c as FamilyCaseRow;
  if (row.status !== "completed" && new Date(row.expires_at) < new Date()) {
    return { error: "expired", status: 403 };
  }

  await supabase
    .from("family_case_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", session.id);

  return { case: row };
}

/**
 * Everything the assessment screen needs, in one round trip: the family never
 * waits on a per-question fetch, and the client is handed only this case's
 * instrument — there is no endpoint that returns any other.
 */
async function buildBundle(supabase: SupabaseClient, c: FamilyCaseRow) {
  const { data: survey } = await supabase
    .from("surveys")
    .select("id, title_en, title_te, description_en, description_te, status")
    .eq("id", c.survey_id)
    .maybeSingle();

  if (!survey || survey.status !== "published") {
    return { case: publicCase(c), survey: null, questions: [], draft: null, submission: null };
  }

  const { data: questions } = await supabase
    .from("survey_questions")
    .select("id, order_index, kind, prompt_en, prompt_te, required, section_id")
    .eq("survey_id", c.survey_id)
    .order("order_index");

  const ids = (questions ?? []).map((q) => q.id as string);
  let options: Record<string, unknown>[] = [];
  if (ids.length) {
    const { data: opts } = await supabase
      .from("survey_question_options")
      .select("id, question_id, order_index, label_en, label_te")
      .in("question_id", ids)
      .order("order_index");
    options = (opts ?? []) as Record<string, unknown>[];
  }

  let submission: Json | null = null;
  if (c.status === "completed" && c.response_id) {
    const { data: r } = await supabase
      .from("survey_responses")
      .select("id, submitted_at, completion_pct")
      .eq("id", c.response_id)
      .maybeSingle();
    if (r) {
      submission = {
        referenceId: c.reference_id,
        assessmentId: formatAssessmentId(r.id as string),
        submittedAt: r.submitted_at,
        completionPct: r.completion_pct ?? 100,
      };
    }
  }

  return {
    case: publicCase(c),
    survey: {
      id: survey.id,
      title_en: survey.title_en,
      title_te: survey.title_te,
      description_en: survey.description_en,
      description_te: survey.description_te,
    },
    questions: (questions ?? []).map((q) => ({
      ...q,
      survey_id: c.survey_id,
      origin: "manual",
      source_ref: null,
      options: options.filter((o) => o.question_id === q.id),
    })),
    draft: c.draft ?? null,
    submission,
  };
}

/** The only shape of a case the respondent's browser is ever given. */
function publicCase(c: FamilyCaseRow) {
  return {
    referenceId: c.reference_id,
    familyHead: c.family_head_name,
    phoneHint: maskPhone(c.phone),
    language: c.preferred_language,
    status: c.status,
    expiresAt: c.expires_at,
  };
}

async function logEvent(supabase: SupabaseClient, caseId: string, event: string, detail: Json, actor: string) {
  await supabase.from("family_case_events").insert({ case_id: caseId, event, detail, actor });
}

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

interface FamilyCaseRow {
  id: string;
  reference_id: string;
  family_head_name: string;
  phone: string;
  preferred_language: string;
  survey_id: string;
  status: string;
  expires_at: string;
  /** When this assessment opens. NULL = immediately. */
  scheduled_for: string | null;
  opened_at: string | null;
  started_at: string | null;
  response_id: string | null;
  failed_attempts: number;
  locked_until: string | null;
  draft: unknown;
}

interface AnswerMetaPayload {
  emoji?: unknown;
  seconds?: unknown;
  skipped?: unknown;
  edited?: unknown;
  voiceUsed?: unknown;
  answeredAt?: unknown;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** Accepts the ways a 10-digit Indian mobile gets typed: +91, 0, spaces, dashes. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 4 ? "••••" : `••••••${digits.slice(-4)}`;
}

function countAnswers(answers: unknown): number {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return 0;
  return Object.values(answers as Record<string, unknown>).filter(
    (v) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
  ).length;
}

/** Length-independent comparison, so response time never leaks how much matched. */
function timingSafeEqual(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function randomToken(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The LEFTMOST X-Forwarded-For entry is client-supplied and trivially spoofed;
 * each trusted proxy APPENDS, so the last hop is the real one. Prefer a
 * platform header, then the last XFF entry — never the first.
 */
function clientIp(req: Request): string {
  const xff = (req.headers.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip") || xff[xff.length - 1] || "unknown";
}

function validStartedAt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return null;
  const now = Date.now();
  // A draft may legitimately have begun days ago; the session TTL bounds it.
  if (ts > now + 60_000 || ts < now - SESSION_TTL_HOURS * 3_600_000) return null;
  return new Date(ts).toISOString();
}

/** A short id a family can read over a phone line without spelling a uuid. */
function formatAssessmentId(uuid: string): string {
  const hex = uuid.replace(/-/g, "").toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
