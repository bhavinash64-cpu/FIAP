import { supabase } from "@/integrations/supabase/client";
import { getSurveyWithQuestions, listSurveys, type QuestionKind, type SurveyQuestion, type SurveyStatus } from "@/lib/surveys";
import { getSurveyStats, labelForValue } from "@/lib/analytics";
import { visualsForQuestion, type OptionVisual } from "@/lib/answerVisuals";
import { formatReferenceId } from "@/lib/assessmentSession";
import { renderBilingual, type LangMode } from "@/lib/i18n";

/**
 * The individual-response side of the platform. Everything else aggregates
 * responses (counts, charts, per-question breakdowns); this is the one place an
 * administrator can open a SINGLE family's submission and read it end to end —
 * the reference ID a parent quotes on the phone leads straight here.
 */

export interface ResponseListItem {
  id: string;
  referenceId: string;
  surveyId: string;
  surveyTitle: string;
  submittedAt: string;
  startedAt: string | null;
  /** Wall-clock seconds the family spent, null when the client never reported a start. */
  secondsTaken: number | null;
  language: string;
}

/** Page the newest responses in, up to a ceiling that stays snappy client-side. */
const LIST_CAP = 2000;
const LIST_PAGE = 1000;

export async function listResponses(): Promise<ResponseListItem[]> {
  const surveysPromise = supabase.from("surveys").select("id, title_en");

  // A single unbounded/limit(500) select silently dropped older responses past
  // the cap. Page the newest LIST_CAP so the explorer covers realistic volumes
  // (older rows past the ceiling remain reachable by narrowing to a survey).
  const rows: { id: string; survey_id: string; submitted_at: string; started_at: string | null; language: string }[] = [];
  for (let from = 0; from < LIST_CAP; from += LIST_PAGE) {
    const { data, error } = await supabase
      .from("survey_responses")
      .select("id, survey_id, submitted_at, started_at, language")
      .order("submitted_at", { ascending: false })
      .range(from, from + LIST_PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < LIST_PAGE) break;
  }

  const { data: surveys } = await surveysPromise;
  const titleById = new Map((surveys ?? []).map((s) => [s.id, s.title_en]));
  return rows.map((r) => ({
    id: r.id,
    referenceId: formatReferenceId(r.id),
    surveyId: r.survey_id,
    surveyTitle: titleById.get(r.survey_id) ?? "—",
    submittedAt: r.submitted_at,
    startedAt: r.started_at,
    secondsTaken: elapsedSeconds(r.started_at, r.submitted_at),
    language: r.language,
  }));
}

/**
 * A clock skew between the parent's device and the server can put started_at
 * after submitted_at; a negative duration is worse than no duration, so those
 * rows report nothing rather than a nonsense number.
 */
function elapsedSeconds(startedAt: string | null, submittedAt: string): number | null {
  if (!startedAt) return null;
  const started = new Date(startedAt).getTime();
  const submitted = new Date(submittedAt).getTime();
  if (!Number.isFinite(started) || !Number.isFinite(submitted)) return null;
  const seconds = Math.round((submitted - started) / 1000);
  return seconds >= 0 ? seconds : null;
}

// ---------------------------------------------------------------------------
// Per-survey rollup for the Responses workspace cards
// ---------------------------------------------------------------------------

/**
 * What a survey card is allowed to say. Question count is deliberately absent:
 * it tells an administrator nothing about collection progress, and leaving it
 * off the type means no card can drift back into showing it.
 */
export interface SurveyResponseSummary {
  id: string;
  title: string;
  status: SurveyStatus;
  responseCount: number;
  /** 0..1, or null when no page views were recorded to compare against. */
  completionRate: number | null;
  lastResponseAt: string | null;
  avgSecondsToComplete: number | null;
}

/**
 * One row per survey, built from the same tested SQL the analytics pages use.
 * Surveys number in the tens, so a fan-out of survey_response_stats is cheaper
 * than a bespoke aggregate — and a single survey whose RPC fails degrades to
 * the count listSurveys already carries instead of blanking the workspace.
 */
export async function getSurveyResponseSummaries(): Promise<SurveyResponseSummary[]> {
  const surveys = await listSurveys();
  return Promise.all(
    surveys.map(async (s): Promise<SurveyResponseSummary> => {
      const fallback: SurveyResponseSummary = {
        id: s.id,
        title: s.title_en,
        status: s.status,
        responseCount: s.response_count,
        completionRate: null,
        lastResponseAt: null,
        avgSecondsToComplete: null,
      };
      try {
        const stats = await getSurveyStats(s.id);
        return {
          ...fallback,
          responseCount: stats.totalResponses,
          completionRate: stats.completionRate,
          lastResponseAt: stats.lastResponseAt,
          avgSecondsToComplete: stats.avgSecondsToComplete,
        };
      } catch {
        return fallback;
      }
    }),
  );
}

/**
 * Answered-question counts for a handful of responses.
 *
 * The workspace shows completion per row, which needs an answer count per
 * response — and there is no grouped aggregate to ask PostgREST for. Rather
 * than pull every answer in the account (tens of thousands of rows) this is
 * called for the VISIBLE PAGE only, so the cost stays flat at roughly
 * page-size × questions no matter how large the survey grows.
 */
export async function getAnswerCounts(responseIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!responseIds.length) return counts;

  const { data, error } = await supabase
    .from("survey_answers")
    .select("response_id")
    .in("response_id", responseIds);
  if (error) throw error;

  for (const row of data ?? []) counts.set(row.response_id, (counts.get(row.response_id) ?? 0) + 1);
  for (const id of responseIds) if (!counts.has(id)) counts.set(id, 0);
  return counts;
}

// ---------------------------------------------------------------------------
// One response, end to end
// ---------------------------------------------------------------------------

const TEXT_KINDS: QuestionKind[] = ["short_text", "long_text"];

export interface ResponseAnswer {
  questionId: string;
  prompt: string;
  answer: string | null;
  kind: QuestionKind;
  isText: boolean;
  /** The glyph/meter of the option actually chosen, or null when the scale carries none. */
  visual: OptionVisual | null;
}

export interface ResponseNote {
  prompt: string;
  text: string;
}

export interface ResponseDetail {
  answered: number;
  total: number;
  /** 0..100, rounded — the figure the inspector header shows. */
  completionPct: number;
  answers: ResponseAnswer[];
  notes: ResponseNote[];
}

interface RawAnswerRow {
  question_id: string;
  value_text: string | null;
  value_int: number | null;
  value_json: unknown;
}

/**
 * The visual for the option this family actually picked.
 *
 * answerVisuals resolves a whole scale at once, so the work here is finding the
 * selected INDEX. Only likert5 (fixed 5-point anchors) and the two
 * single-select option kinds have an index to find — checkboxes have several,
 * rating5 and yes/no are scales the module deliberately refuses to face-ramp,
 * and an empty visual is returned as null so the inspector renders nothing
 * rather than an empty slot.
 */
function selectedVisual(question: SurveyQuestion, raw: RawAnswerRow, visuals: OptionVisual[]): OptionVisual | null {
  if (!visuals.length) return null;

  let index = -1;
  if (question.kind === "likert5") {
    if (raw.value_int == null) return null;
    index = raw.value_int - 1;
  } else if (question.kind === "multiple_choice" || question.kind === "dropdown") {
    if (!raw.value_text) return null;
    index = question.options.findIndex((o) => o.id === raw.value_text);
  } else {
    return null;
  }

  const visual = visuals[index];
  if (!visual) return null;
  return visual.emoji || visual.level ? visual : null;
}

/**
 * A response's full answer sheet, one row per question in survey order. The
 * caller already holds the reference id / survey / date / language from the
 * list row, so this returns only the answers.
 *
 * Stored answers are reconstructed to display values the same way the export
 * does — option ids and Likert integers become their labels via
 * labelForValue — so what an administrator reads here matches the workbook and
 * the analytics breakdowns exactly.
 */
export async function getResponseDetail(
  responseId: string,
  surveyId: string,
  mode: LangMode,
): Promise<ResponseDetail | null> {
  const [detail, answersRes] = await Promise.all([
    getSurveyWithQuestions(surveyId),
    supabase
      .from("survey_answers")
      .select("question_id, value_text, value_int, value_json")
      .eq("response_id", responseId),
  ]);
  if (answersRes.error) throw answersRes.error;
  if (!detail) return null;

  const byQuestion = new Map((answersRes.data ?? []).map((a) => [a.question_id, a]));

  const rows: ResponseAnswer[] = detail.questions.map((q) => {
    const a = byQuestion.get(q.id);
    let display: string | null = null;
    if (a) {
      if (a.value_json && Array.isArray(a.value_json)) {
        display = (a.value_json as string[]).map((v) => labelForValue(q, v)).join(", ") || null;
      } else if (a.value_int != null) {
        display = labelForValue(q, String(a.value_int));
      } else if (a.value_text != null && a.value_text !== "") {
        display = ["multiple_choice", "dropdown", "yes_no"].includes(q.kind)
          ? labelForValue(q, a.value_text)
          : a.value_text;
      }
    }
    return {
      questionId: q.id,
      prompt: renderBilingual(mode, q.prompt_en, q.prompt_te).primary,
      answer: display,
      kind: q.kind,
      isText: TEXT_KINDS.includes(q.kind),
      visual: a ? selectedVisual(q, a, visualsForQuestion(q).visuals) : null,
    };
  });

  const answered = rows.filter((r) => r.answer != null).length;
  return {
    answered,
    total: rows.length,
    completionPct: rows.length ? Math.round((answered / rows.length) * 100) : 0,
    answers: rows,
    notes: rows
      .filter((r) => r.isText && r.answer)
      .map((r) => ({ prompt: r.prompt, text: r.answer as string })),
  };
}
