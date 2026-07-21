import { supabase } from "@/integrations/supabase/client";
import type { SurveyQuestion } from "@/lib/surveys";

export type RangeKey = "7d" | "30d" | "12m";

export interface SurveyStats {
  totalResponses: number;
  responsesToday: number;
  lastResponseAt: string | null;
  avgSecondsToComplete: number | null;
  totalViews: number;
  completionRate: number | null; // null when there's no view data to compare against
}

export async function getSurveyStats(surveyId: string): Promise<SurveyStats> {
  const { data, error } = await supabase.rpc("survey_response_stats", { p_survey_id: surveyId });
  if (error) throw error;
  const row = data?.[0];
  const totalResponses = row?.total_responses ?? 0;
  const totalViews = row?.total_views ?? 0;
  return {
    totalResponses,
    responsesToday: row?.responses_today ?? 0,
    lastResponseAt: row?.last_response_at ?? null,
    avgSecondsToComplete: row?.avg_seconds_to_complete ?? null,
    totalViews,
    completionRate: totalViews > 0 ? Math.min(1, totalResponses / totalViews) : null,
  };
}

export function rangeToSince(range: RangeKey): { since: Date; granularity: "day" | "month"; bucketCount: number } {
  const now = new Date();
  if (range === "7d") return { since: new Date(now.getTime() - 7 * 86400000), granularity: "day", bucketCount: 7 };
  if (range === "30d") return { since: new Date(now.getTime() - 30 * 86400000), granularity: "day", bucketCount: 30 };
  const since = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return { since, granularity: "month", bucketCount: 12 };
}

export interface TimeseriesPoint {
  date: string; // ISO
  label: string;
  count: number;
}

export async function getResponseTimeseries(surveyId: string, range: RangeKey): Promise<TimeseriesPoint[]> {
  const { since, granularity, bucketCount } = rangeToSince(range);
  const { data, error } = await supabase.rpc("survey_response_timeseries", {
    p_survey_id: surveyId,
    p_granularity: granularity,
    p_since: since.toISOString(),
  });
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(new Date(row.bucket).toISOString().slice(0, granularity === "day" ? 10 : 7), row.count);

  const points: TimeseriesPoint[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < bucketCount; i++) {
    const key = cursor.toISOString().slice(0, granularity === "day" ? 10 : 7);
    const label = granularity === "day"
      ? cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : cursor.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    points.push({ date: key, label, count: counts.get(key) ?? 0 });
    if (granularity === "day") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  return points;
}

export interface ValueCount {
  value: string;
  label: string;
  count: number;
  pct: number;
}

const YES_NO_LABELS: Record<string, string> = { yes: "Yes", no: "No" };
const LIKERT_LABELS = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

export function labelForValue(question: SurveyQuestion, value: string): string {
  if (question.kind === "yes_no") return YES_NO_LABELS[value] ?? value;
  if (question.kind === "likert5") return LIKERT_LABELS[Number(value) - 1] ?? value;
  if (question.kind === "rating5") return `${value} star${value === "1" ? "" : "s"}`;
  const opt = question.options.find((o) => o.id === value);
  return opt?.label_en ?? value;
}

export async function getQuestionBreakdown(question: SurveyQuestion, since?: Date): Promise<ValueCount[]> {
  const { data, error } = await supabase.rpc("question_value_counts", {
    p_question_id: question.id,
    p_since: since?.toISOString() ?? null,
  });
  if (error) throw error;
  const rows = data ?? [];
  const total = rows.reduce((a, r) => a + Number(r.count), 0);
  const mapped = rows.map((r) => ({
    value: r.value,
    label: labelForValue(question, r.value),
    count: Number(r.count),
    pct: total ? Number(r.count) / total : 0,
  }));

  // Keep a stable, meaningful order: option order for choice kinds, scale order for likert/rating.
  if (question.kind === "likert5" || question.kind === "rating5") {
    return mapped.sort((a, b) => Number(a.value) - Number(b.value));
  }
  if (question.options.length) {
    const order = new Map(question.options.map((o, i) => [o.id, i]));
    return mapped.sort((a, b) => (order.get(a.value) ?? 99) - (order.get(b.value) ?? 99));
  }
  return mapped.sort((a, b) => b.count - a.count);
}

export function averageScore(counts: ValueCount[]): number | null {
  const total = counts.reduce((a, c) => a + c.count, 0);
  if (!total) return null;
  const weighted = counts.reduce((a, c) => a + Number(c.value) * c.count, 0);
  return weighted / total;
}

export interface TextAnswer {
  id: string;
  value: string;
  submittedAt: string;
}

export async function getTextAnswers(questionId: string, opts: { search?: string; limit?: number; offset?: number } = {}): Promise<{ rows: TextAnswer[]; total: number }> {
  const { search = "", limit = 25, offset = 0 } = opts;
  let query = supabase
    .from("survey_answers")
    .select("id, value_text, survey_responses(submitted_at)", { count: "exact" })
    .eq("question_id", questionId)
    .not("value_text", "is", null)
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1);
  if (search.trim()) query = query.ilike("value_text", `%${search.trim()}%`);
  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []).map((r) => ({
    id: r.id,
    value: r.value_text ?? "",
    submittedAt: (r as unknown as { survey_responses: { submitted_at: string } | null }).survey_responses?.submitted_at ?? "",
  }));
  return { rows, total: count ?? rows.length };
}

/** Resolves a report route's `?range=` query param into a since-date + human label. Falls back to all-time. */
export function resolveReportRange(param: string | null): { since?: Date; label: string } {
  const now = new Date();
  switch (param) {
    case "7d": return { since: new Date(now.getTime() - 7 * 86400000), label: "Last 7 days" };
    case "30d": return { since: new Date(now.getTime() - 30 * 86400000), label: "Last 30 days" };
    case "12m": return { since: new Date(now.getFullYear(), now.getMonth() - 11, 1), label: "Last 12 months" };
    case "week": return { since: new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()), label: "This week" };
    case "month": return { since: new Date(now.getFullYear(), now.getMonth(), 1), label: "This month" };
    case "year": return { since: new Date(now.getFullYear(), 0, 1), label: "This year" };
    default: return { label: "All time" };
  }
}

export type Period = "week" | "month" | "year";

export interface PeriodComparison {
  current: number;
  previous: number;
  pctChange: number | null; // null when previous was 0 (can't compute a meaningful percentage)
}

export async function getPeriodComparison(surveyId: string, period: Period): Promise<PeriodComparison> {
  const { data, error } = await supabase.rpc("survey_period_comparison", { p_survey_id: surveyId, p_period: period });
  if (error) throw error;
  const row = data?.[0];
  const current = row?.current_count ?? 0;
  const previous = row?.previous_count ?? 0;
  return { current, previous, pctChange: previous > 0 ? ((current - previous) / previous) * 100 : null };
}

// ---------------------------------------------------------------------------
// Export data — a full, on-demand pull (not the fast-loading dashboard path).
// ---------------------------------------------------------------------------

export interface ExportResponseRow {
  responseId: string;
  submittedAt: string;
  language: string;
  answers: Record<string, string>; // question_id -> display value
}

/**
 * PostgREST/Supabase caps every unbounded select at the project's max_rows
 * (1000 by default). An export that awaited a single select therefore lost
 * every row past the first 1000 — silently. Both the responses and the (far
 * larger) answers sets must be paged with .range() to be complete.
 */
const EXPORT_PAGE = 1000;

interface RawResponse {
  id: string;
  submitted_at: string;
  language: string;
}
interface RawAnswer {
  response_id: string;
  question_id: string;
  value_text: string | null;
  value_int: number | null;
  value_json: unknown;
}

async function fetchAllResponses(surveyId: string, since?: Date): Promise<RawResponse[]> {
  const out: RawResponse[] = [];
  for (let from = 0; ; from += EXPORT_PAGE) {
    let q = supabase
      .from("survey_responses")
      .select("id, submitted_at, language")
      .eq("survey_id", surveyId)
      .order("submitted_at")
      .range(from, from + EXPORT_PAGE - 1);
    if (since) q = q.gte("submitted_at", since.toISOString());
    const { data, error } = await q;
    if (error) throw error;
    if (!data?.length) break;
    out.push(...(data as RawResponse[]));
    if (data.length < EXPORT_PAGE) break;
  }
  return out;
}

async function fetchAllAnswers(responseIds: string[]): Promise<RawAnswer[]> {
  const out: RawAnswer[] = [];
  // Keep the IN() list small so the request URL stays well under limits, and
  // page each chunk since a survey has many answers per response.
  const CHUNK = 300;
  for (let i = 0; i < responseIds.length; i += CHUNK) {
    const chunk = responseIds.slice(i, i + CHUNK);
    for (let from = 0; ; from += EXPORT_PAGE) {
      const { data, error } = await supabase
        .from("survey_answers")
        .select("response_id, question_id, value_text, value_int, value_json")
        .in("response_id", chunk)
        .range(from, from + EXPORT_PAGE - 1);
      if (error) throw error;
      if (!data?.length) break;
      out.push(...(data as RawAnswer[]));
      if (data.length < EXPORT_PAGE) break;
    }
  }
  return out;
}

/** Exact response count for a period — a head/count query, no rows pulled. */
export async function getResponseCount(surveyId: string, since?: Date): Promise<number> {
  let q = supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", surveyId);
  if (since) q = q.gte("submitted_at", since.toISOString());
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

export async function getResponsesForExport(surveyId: string, questions: SurveyQuestion[], since?: Date): Promise<ExportResponseRow[]> {
  const responses = await fetchAllResponses(surveyId, since);
  const ids = responses.map((r) => r.id);
  if (!ids.length) return [];

  const answers = await fetchAllAnswers(ids);

  const qById = new Map(questions.map((q) => [q.id, q]));
  const byResponse = new Map<string, Record<string, string>>();
  for (const a of answers) {
    const q = qById.get(a.question_id);
    if (!q) continue;
    let display = "";
    if (a.value_json && Array.isArray(a.value_json)) {
      display = (a.value_json as string[]).map((v) => labelForValue(q, v)).join(", ");
    } else if (a.value_int != null) {
      display = labelForValue(q, String(a.value_int));
    } else if (a.value_text != null) {
      display = ["multiple_choice", "dropdown", "yes_no"].includes(q.kind) ? labelForValue(q, a.value_text) : a.value_text;
    }
    const bucket = byResponse.get(a.response_id) ?? {};
    bucket[a.question_id] = display;
    byResponse.set(a.response_id, bucket);
  }

  return responses.map((r) => ({
    responseId: r.id,
    submittedAt: r.submitted_at,
    language: r.language,
    answers: byResponse.get(r.id) ?? {},
  }));
}
