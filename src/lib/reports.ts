import { supabase } from "@/integrations/supabase/client";
import { averageScore, getQuestionBreakdown } from "@/lib/analytics";
import { getSurveyWithQuestions, type QuestionKind, type SurveyStatus } from "@/lib/surveys";
import { countModified, isInstrumentModified, listBank } from "@/lib/questionBank";
import type { ResponseListItem, SurveyResponseSummary } from "@/lib/responseExplorer";

/**
 * The research-analysis layer behind the Reports page.
 *
 * Everything that can be derived from the response list is a PURE function over
 * the already-cached ["all-responses"] array, so changing survey or period on
 * Reports costs no network at all — the page recomputes synchronously in a
 * useMemo. Only the two genuinely relational views (per-question breakdowns and
 * instrument usage) reach the database, and both are lazy.
 */

export type TrendPeriod = "week" | "month" | "year";

export interface TrendPoint {
  /** Local calendar key of the bucket start — stable across re-renders. */
  key: string;
  label: string;
  count: number;
}

/** How far back each period looks. Weeks/months read as a year; years as a term. */
const TREND_BUCKETS: Record<TrendPeriod, number> = { week: 12, month: 12, year: 5 };

const PERIOD_NOUN: Record<TrendPeriod, string> = { week: "week", month: "month", year: "year" };

export const periodNoun = (p: TrendPeriod) => PERIOD_NOUN[p];

// ---------------------------------------------------------------------------
// Local calendar helpers
//
// Every bucket boundary is LOCAL, matching the dashboard's day bucketing. A UTC
// key here would disagree with the "today" counters elsewhere for anyone east
// of Greenwich — which is everyone using this product.
// ---------------------------------------------------------------------------

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Week starts Sunday, matching resolveReportRange's existing "week" window. */
function startOfWeek(d: Date): Date {
  const x = startOfDay(d);
  x.setDate(x.getDate() - x.getDay());
  return x;
}

function bucketStart(d: Date, period: TrendPeriod): Date {
  if (period === "week") return startOfWeek(d);
  if (period === "month") return new Date(d.getFullYear(), d.getMonth(), 1);
  return new Date(d.getFullYear(), 0, 1);
}

function shiftBuckets(d: Date, period: TrendPeriod, n: number): Date {
  const x = new Date(d);
  if (period === "week") x.setDate(x.getDate() - 7 * n);
  else if (period === "month") x.setMonth(x.getMonth() - n);
  else x.setFullYear(x.getFullYear() - n);
  return x;
}

function bucketKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function bucketLabel(d: Date, period: TrendPeriod): string {
  if (period === "week") return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  if (period === "month") return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  return String(d.getFullYear());
}

/** Narrow to one survey, or pass through when the scope is every survey. */
export function scopeRows(rows: ResponseListItem[], surveyId?: string): ResponseListItem[] {
  if (!surveyId || surveyId === "all") return rows;
  return rows.filter((r) => r.surveyId === surveyId);
}

// ---------------------------------------------------------------------------
// Trends
// ---------------------------------------------------------------------------

export function buildTrend(rows: ResponseListItem[], period: TrendPeriod, surveyId?: string): TrendPoint[] {
  const scoped = scopeRows(rows, surveyId);
  const now = new Date();
  const latest = bucketStart(now, period);
  const count = TREND_BUCKETS[period];

  const points: TrendPoint[] = [];
  const index = new Map<string, number>();
  for (let i = count - 1; i >= 0; i--) {
    const start = bucketStart(shiftBuckets(latest, period, i), period);
    const key = bucketKey(start);
    index.set(key, points.length);
    points.push({ key, label: bucketLabel(start, period), count: 0 });
  }

  for (const r of scoped) {
    const at = new Date(r.submittedAt);
    if (Number.isNaN(at.getTime())) continue;
    const slot = index.get(bucketKey(bucketStart(at, period)));
    if (slot !== undefined) points[slot].count++;
  }
  return points;
}

export interface PeriodDelta {
  current: number;
  previous: number;
  /** null when the previous period was empty — a percentage off zero is meaningless. */
  pctChange: number | null;
}

/**
 * This period against the one before it, computed locally so the period tabs on
 * Reports switch instantly instead of waiting on the survey_period_comparison
 * RPC once per tab press.
 */
export function periodOverPeriod(rows: ResponseListItem[], period: TrendPeriod, surveyId?: string): PeriodDelta {
  const scoped = scopeRows(rows, surveyId);
  const currentStart = bucketStart(new Date(), period);
  const previousStart = bucketStart(shiftBuckets(currentStart, period, 1), period);

  let current = 0;
  let previous = 0;
  for (const r of scoped) {
    const at = new Date(r.submittedAt).getTime();
    if (Number.isNaN(at)) continue;
    if (at >= currentStart.getTime()) current++;
    else if (at >= previousStart.getTime()) previous++;
  }
  return { current, previous, pctChange: previous > 0 ? ((current - previous) / previous) * 100 : null };
}

// ---------------------------------------------------------------------------
// Distributions
// ---------------------------------------------------------------------------

export interface LanguageSlice {
  language: string;
  label: string;
  count: number;
  pct: number;
}

const LANGUAGE_LABEL: Record<string, string> = { en: "English", te: "Telugu" };

export function buildLanguageBreakdown(rows: ResponseListItem[], surveyId?: string): LanguageSlice[] {
  const scoped = scopeRows(rows, surveyId);
  const counts = new Map<string, number>();
  for (const r of scoped) counts.set(r.language, (counts.get(r.language) ?? 0) + 1);

  const total = scoped.length;
  return Array.from(counts.entries())
    .map(([language, count]) => ({
      language,
      label: LANGUAGE_LABEL[language] ?? language.toUpperCase(),
      count,
      pct: total ? count / total : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

export interface DistributionSlice {
  surveyId: string;
  title: string;
  count: number;
  pct: number;
}

export function buildResponseDistribution(rows: ResponseListItem[]): DistributionSlice[] {
  const counts = new Map<string, { title: string; count: number }>();
  for (const r of rows) {
    const entry = counts.get(r.surveyId) ?? { title: r.surveyTitle, count: 0 };
    entry.count++;
    counts.set(r.surveyId, entry);
  }
  const total = rows.length;
  return Array.from(counts.entries())
    .map(([surveyId, v]) => ({ surveyId, title: v.title, count: v.count, pct: total ? v.count / total : 0 }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

export interface CompletionStats {
  totalResponses: number;
  /** Mean of the per-survey submitted/viewed rates, weighted by responses. */
  avgCompletionRate: number | null;
  avgSecondsToComplete: number | null;
  medianSecondsToComplete: number | null;
  /** How many responses carried usable timing — the honesty figure for the two above. */
  responsesWithTiming: number;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export function buildCompletionStats(
  rows: ResponseListItem[],
  summaries: SurveyResponseSummary[],
  surveyId?: string,
): CompletionStats {
  const scoped = scopeRows(rows, surveyId);
  const timings = scoped.map((r) => r.secondsTaken).filter((s): s is number => s != null);

  const relevant =
    !surveyId || surveyId === "all" ? summaries : summaries.filter((s) => s.id === surveyId);
  const rated = relevant.filter((s) => s.completionRate != null && s.responseCount > 0);
  const weight = rated.reduce((n, s) => n + s.responseCount, 0);

  return {
    totalResponses: scoped.length,
    avgCompletionRate: weight
      ? rated.reduce((n, s) => n + (s.completionRate as number) * s.responseCount, 0) / weight
      : null,
    avgSecondsToComplete: timings.length
      ? Math.round(timings.reduce((n, s) => n + s, 0) / timings.length)
      : null,
    medianSecondsToComplete: median(timings),
    responsesWithTiming: timings.length,
  };
}

/** "4m 12s" / "48s" / "1h 06m" — compact enough for a stat tile. */
export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m < 60) return s ? `${m}m ${String(s).padStart(2, "0")}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, "0")}m`;
}

// ---------------------------------------------------------------------------
// Survey comparison
// ---------------------------------------------------------------------------

export interface SurveyComparisonRow {
  id: string;
  title: string;
  status: SurveyStatus;
  responses: number;
  sharePct: number;
  completionRate: number | null;
  avgSeconds: number | null;
  lastResponseAt: string | null;
}

export function buildSurveyComparison(
  summaries: SurveyResponseSummary[],
  rows: ResponseListItem[],
): SurveyComparisonRow[] {
  const total = summaries.reduce((n, s) => n + s.responseCount, 0);

  // The list carries timing the RPC does not, so per-survey averages come from
  // the rows where they exist and fall back to the RPC's figure otherwise.
  const bySurvey = new Map<string, number[]>();
  for (const r of rows) {
    if (r.secondsTaken == null) continue;
    const bucket = bySurvey.get(r.surveyId) ?? [];
    bucket.push(r.secondsTaken);
    bySurvey.set(r.surveyId, bucket);
  }

  return summaries
    .map((s) => {
      const timings = bySurvey.get(s.id) ?? [];
      return {
        id: s.id,
        title: s.title,
        status: s.status,
        responses: s.responseCount,
        sharePct: total ? s.responseCount / total : 0,
        completionRate: s.completionRate,
        avgSeconds: timings.length
          ? Math.round(timings.reduce((n, v) => n + v, 0) / timings.length)
          : s.avgSecondsToComplete,
        lastResponseAt: s.lastResponseAt,
      };
    })
    .sort((a, b) => b.responses - a.responses);
}

// ---------------------------------------------------------------------------
// Question-level analysis (lazy — one RPC per question)
// ---------------------------------------------------------------------------

export interface QuestionStat {
  id: string;
  prompt: string;
  kind: QuestionKind;
  responseCount: number;
  topLabel: string | null;
  topPct: number;
  /** Mean on the underlying scale, for likert5 / rating5 only. */
  average: number | null;
  /** Scales where an average is meaningful get a 1..5 denominator. */
  scaleMax: number | null;
}

const SCALE_KINDS: QuestionKind[] = ["likert5", "rating5"];
/** Free text has no distribution worth charting — it is reviewed, not counted. */
const TEXT_KINDS: QuestionKind[] = ["short_text", "long_text"];

/** Small enough to be polite to the database, large enough to finish quickly. */
const RPC_CONCURRENCY = 6;

export async function getQuestionStatistics(surveyId: string, since?: Date): Promise<QuestionStat[]> {
  const detail = await getSurveyWithQuestions(surveyId);
  if (!detail) return [];

  const countable = detail.questions.filter((q) => !TEXT_KINDS.includes(q.kind));
  const out: QuestionStat[] = [];

  // A 100-item instrument would otherwise open 100 sockets at once and get
  // throttled; chunking keeps the page responsive and the backend calm.
  for (let i = 0; i < countable.length; i += RPC_CONCURRENCY) {
    const chunk = countable.slice(i, i + RPC_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (q) => {
        try {
          const counts = await getQuestionBreakdown(q, since);
          const responseCount = counts.reduce((n, c) => n + c.count, 0);
          const top = counts.reduce<typeof counts[number] | null>(
            (best, c) => (!best || c.count > best.count ? c : best),
            null,
          );
          return {
            id: q.id,
            prompt: q.prompt_en,
            kind: q.kind,
            responseCount,
            topLabel: top && top.count > 0 ? top.label : null,
            topPct: top && responseCount ? top.count / responseCount : 0,
            average: SCALE_KINDS.includes(q.kind) ? averageScore(counts) : null,
            scaleMax: SCALE_KINDS.includes(q.kind) ? 5 : null,
          } satisfies QuestionStat;
        } catch {
          // One unreadable question must not blank the whole section.
          return {
            id: q.id,
            prompt: q.prompt_en,
            kind: q.kind,
            responseCount: 0,
            topLabel: null,
            topPct: 0,
            average: null,
            scaleMax: null,
          } satisfies QuestionStat;
        }
      }),
    );
    out.push(...results);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Instrument analytics
// ---------------------------------------------------------------------------

export interface InstrumentStat {
  id: string;
  code: string;
  name: string;
  source: string | null;
  itemCount: number;
  isBuiltin: boolean;
  modified: boolean;
  modifiedItems: number;
  /** How many surveys currently contain questions copied from this instrument. */
  surveysUsing: number;
  questionsInUse: number;
}

/**
 * Library questions are copied into a survey verbatim (importInstrumentsToSurvey
 * writes prompt_en straight across), so matching on the English prompt is an
 * exact join in practice and costs one select instead of a schema change.
 */
export async function getInstrumentAnalytics(): Promise<InstrumentStat[]> {
  const [bank, questionsRes] = await Promise.all([
    listBank(),
    supabase.from("survey_questions").select("survey_id, prompt_en"),
  ]);
  if (questionsRes.error) throw questionsRes.error;

  const questions = questionsRes.data ?? [];

  return bank
    .map((inst) => {
      const prompts = new Set(inst.items.map((i) => i.prompt_en.trim()).filter(Boolean));
      const surveys = new Set<string>();
      let questionsInUse = 0;
      for (const q of questions) {
        if (!prompts.has((q.prompt_en ?? "").trim())) continue;
        questionsInUse++;
        surveys.add(q.survey_id);
      }
      return {
        id: inst.id,
        code: inst.code,
        name: inst.name_en,
        source: inst.source,
        itemCount: inst.items.length,
        isBuiltin: inst.is_builtin,
        modified: isInstrumentModified(inst),
        modifiedItems: countModified(inst),
        surveysUsing: surveys.size,
        questionsInUse,
      };
    })
    .sort((a, b) => b.surveysUsing - a.surveysUsing || b.itemCount - a.itemCount);
}
