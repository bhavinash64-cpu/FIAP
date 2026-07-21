import type { SupabaseClient } from "@supabase/supabase-js";
// Type-only, so it is erased at build time and the dynamic `import("exceljs")`
// below stays the sole reason the 900kB library is ever fetched.
import type { Workbook, Worksheet } from "exceljs";
import { supabase } from "@/integrations/supabase/client";
import { labelForValue } from "@/lib/analytics";
import { downloadBlob, slugifyFilename } from "@/lib/exportExcel";
import type { FamilyCaseRow, FamilyCaseStatus } from "@/lib/familyCases";
import { formatDuration } from "@/lib/reports";
import type { SurveyOption, SurveyQuestion } from "@/lib/surveys";

/**
 * The research output.
 *
 * Everything else in this product is an interface; this file is the artefact the
 * study is actually for. A supervisor, a statistician and a reviewer will each
 * open this workbook years after the console has been switched off, so the one
 * rule governing every decision below is: the file must survive without us.
 * That means a rectangular matrix with a single header row, real numbers and
 * real dates, no merged cells, and a codebook shipped alongside so a stranger
 * can read column BQ without asking anyone what it means.
 */

const HEADER_FILL = "FF122A54"; // matches the app's deep navy primary
const HEADER_FONT = "FFFFFFFF";

/**
 * A question the family was shown and deliberately moved past, versus a question
 * their session never reached, are two different research facts and must not
 * collapse into the same blank cell. A skip is a datum — it says this family saw
 * this item and declined it. "Never reached" says nothing at all. The metadata
 * captured at submit time is what lets us tell them apart, so the matrix spends
 * a sentinel on the first and leaves the second genuinely empty.
 */
const SKIPPED_CELL = "[SKIPPED]";

/** Kinds whose stored value is an option id / code rather than the text itself. */
const CODED_KINDS = ["multiple_choice", "dropdown", "yes_no"];

/**
 * The generated Supabase types are regenerated from the schema and currently
 * predate the family-case migrations, so `family_cases`, `family_case_events`
 * and the per-answer metadata columns are invisible to the typed client even
 * though they exist in the database. Reading through a deliberately untyped
 * handle keeps this file compiling against reality; every row shape it returns
 * is declared explicitly below, so nothing here is actually loosely typed.
 */
const db = supabase as unknown as SupabaseClient;

/**
 * PostgREST caps every unbounded select at max_rows (1000). A research export
 * that awaited a single select would lose row 1001 onwards *silently* — the
 * request succeeds, the file looks fine, and the analysis is wrong. Every read
 * in this file is paged.
 */
const PAGE = 1000;

/** Keeps an IN() list short enough that the request URL stays well inside limits. */
const ID_CHUNK = 300;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

/** One answered (or skipped) cell, with the session facts that explain it. */
export interface FamilyAnswerCell {
  questionId: string;
  /** Resolved for humans: option label, Likert wording, "3 stars", free text. */
  display: string;
  /** The underlying code where one exists — Likert 1–5, rating 1–5, ints. */
  numeric: number | null;
  emoji: string | null;
  skipped: boolean;
  edited: boolean;
  voiceUsed: boolean;
  secondsSpent: number | null;
  answeredAt: string | null;
}

/** One family case, flattened into the row the Families sheet writes. */
export interface FamilyExportRow {
  caseId: string;
  referenceId: string;
  familyHead: string;
  deceasedName: string;
  relationship: string;
  phone: string;
  district: string;
  village: string;
  surveyId: string;
  surveyTitle: string;
  /** "en" | "te" as stored; the sheet writes the readable form. */
  language: string;
  officer: string;
  status: FamilyCaseStatus;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  durationSeconds: number | null;
  questionCount: number | null;
  answeredCount: number | null;
  skippedCount: number;
  completionPct: number | null;
  /** question_id -> cell. A missing key means the question was never reached. */
  answers: Record<string, FamilyAnswerCell>;
}

/** One row of the case timeline, already resolved to its family's reference id. */
export interface FamilyEventExportRow {
  referenceId: string;
  event: string;
  actor: string;
  detail: string;
  createdAt: string;
}

export interface FamilyResearchData {
  rows: FamilyExportRow[];
  /** Every question across every survey involved, in matrix-column order. */
  questions: SurveyQuestion[];
  surveys: { id: string; title_en: string; title_te: string | null }[];
  events: FamilyEventExportRow[];
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

interface RawCase {
  id: string;
  reference_id: string;
  deceased_name: string;
  family_head_name: string;
  relationship: string;
  phone: string;
  district: string;
  village: string | null;
  preferred_language: string;
  survey_id: string;
  status: FamilyCaseStatus;
  officer_name: string | null;
  created_at: string;
  started_at: string | null;
  response_id: string | null;
}

interface RawResponse {
  id: string;
  family_case_id: string | null;
  submitted_at: string;
  language: string;
  duration_seconds: number | null;
  question_count: number | null;
  answered_count: number | null;
  completion_pct: number | string | null;
  started_at: string | null;
}

interface RawAnswer {
  response_id: string;
  question_id: string;
  value_text: string | null;
  value_int: number | null;
  value_json: unknown;
  emoji: string | null;
  seconds_spent: number | null;
  skipped: boolean;
  edited: boolean;
  voice_used: boolean;
  answered_at: string | null;
}

interface RawEvent {
  case_id: string;
  event: string;
  actor: string;
  detail: unknown;
  created_at: string;
}

async function pageAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < PAGE) break;
  }
  return out;
}

function chunked<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Every paged query below ends with `.order("id")`.
 *
 * `.range()` paging is only coherent over a TOTAL order. Ordering by
 * created_at/order_index alone leaves ties free to come back in a different
 * arrangement on each request, which makes a row appear on two pages and
 * another on none — a corruption that looks like clean data. The id tiebreak
 * costs nothing and removes the whole class of failure.
 */

/** Pages every chunk of an IN() filter and concatenates — the two loops compose. */
async function pageAllIn<T>(
  ids: string[],
  build: (chunk: string[], from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const out: T[] = [];
  for (const chunk of chunked(ids, ID_CHUNK)) {
    out.push(...(await pageAll<T>((from, to) => build(chunk, from, to))));
  }
  return out;
}

const CASE_COLUMNS =
  "id, reference_id, deceased_name, family_head_name, relationship, phone, district, village, " +
  "preferred_language, survey_id, status, officer_name, created_at, started_at, response_id";

const RESPONSE_COLUMNS =
  "id, family_case_id, submitted_at, language, duration_seconds, question_count, answered_count, " +
  "completion_pct, started_at";

const ANSWER_COLUMNS =
  "response_id, question_id, value_text, value_int, value_json, emoji, seconds_spent, skipped, " +
  "edited, voice_used, answered_at";

/**
 * Pulls the whole research set for the given cases — or for every case when no
 * ids are passed.
 *
 * An explicitly empty array means "no cases", not "all cases": an admin who
 * filtered a list down to nothing and pressed Export must get an empty
 * workbook, never the entire study.
 */
export async function loadFamilyResearchData(caseIds?: string[]): Promise<FamilyResearchData> {
  if (caseIds && caseIds.length === 0) return { rows: [], questions: [], surveys: [], events: [] };

  const cases = caseIds
    ? await pageAllIn<RawCase>(caseIds, (chunk, from, to) =>
        db.from("family_cases").select(CASE_COLUMNS).in("id", chunk).order("created_at").order("id").range(from, to),
      )
    : await pageAll<RawCase>((from, to) =>
        db.from("family_cases").select(CASE_COLUMNS).order("created_at").order("id").range(from, to),
      );

  if (!cases.length) return { rows: [], questions: [], surveys: [], events: [] };

  const ids = cases.map((c) => c.id);
  const surveyIds = Array.from(new Set(cases.map((c) => c.survey_id)));

  const [surveys, questions, responses, rawEvents] = await Promise.all([
    fetchSurveys(surveyIds),
    fetchQuestions(surveyIds),
    pageAllIn<RawResponse>(ids, (chunk, from, to) =>
      db.from("survey_responses").select(RESPONSE_COLUMNS).in("family_case_id", chunk).order("submitted_at").order("id").range(from, to),
    ),
    pageAllIn<RawEvent>(ids, (chunk, from, to) =>
      db
        .from("family_case_events")
        .select("case_id, event, actor, detail, created_at")
        .in("case_id", chunk)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);

  const referenceByCase = new Map(cases.map((c) => [c.id, c.reference_id]));
  const events: FamilyEventExportRow[] = rawEvents.map((e) => ({
    referenceId: referenceByCase.get(e.case_id) ?? "",
    event: e.event,
    actor: e.actor,
    detail: describeDetail(e.detail),
    createdAt: e.created_at,
  }));

  const answers = await pageAllIn<RawAnswer>(
    responses.map((r) => r.id),
    (chunk, from, to) => db.from("survey_answers").select(ANSWER_COLUMNS).in("response_id", chunk).order("id").range(from, to),
  );

  const questionById = new Map(questions.map((q) => [q.id, q]));
  const surveyTitleById = new Map(surveys.map((s) => [s.id, s.title_en]));

  // Reopening a case deliberately leaves the earlier submission in place, so a
  // family can own more than one response while the export is one row per
  // family. The case's own response_id is the authoritative pointer to the
  // sitting that counts; the latest submission is only the fallback for rows
  // where that pointer was cleared.
  const responseById = new Map(responses.map((r) => [r.id, r]));
  const latestByCase = new Map<string, RawResponse>();
  for (const r of responses) {
    if (!r.family_case_id) continue;
    const held = latestByCase.get(r.family_case_id);
    if (!held || new Date(r.submitted_at) >= new Date(held.submitted_at)) latestByCase.set(r.family_case_id, r);
  }
  const responseForCase = (c: RawCase) =>
    (c.response_id ? responseById.get(c.response_id) : undefined) ?? latestByCase.get(c.id);

  const cellsByResponse = new Map<string, Record<string, FamilyAnswerCell>>();
  for (const a of answers) {
    const question = questionById.get(a.question_id);
    if (!question) continue; // question deleted since submission — no column to write it to
    const bucket = cellsByResponse.get(a.response_id) ?? {};
    bucket[a.question_id] = toCell(question, a);
    cellsByResponse.set(a.response_id, bucket);
  }

  const rows: FamilyExportRow[] = cases.map((c) => {
    const response = responseForCase(c);
    const cells = response ? cellsByResponse.get(response.id) ?? {} : {};
    const cellList = Object.values(cells);
    const answeredFromCells = cellList.filter((cell) => !cell.skipped && cell.display !== "").length;
    return {
      caseId: c.id,
      referenceId: c.reference_id,
      familyHead: c.family_head_name,
      deceasedName: c.deceased_name,
      relationship: c.relationship,
      phone: c.phone,
      district: c.district,
      village: c.village ?? "",
      surveyId: c.survey_id,
      surveyTitle: surveyTitleById.get(c.survey_id) ?? "",
      language: response?.language ?? c.preferred_language,
      officer: c.officer_name ?? "",
      status: c.status,
      createdAt: c.created_at,
      startedAt: response?.started_at ?? c.started_at ?? null,
      submittedAt: response?.submitted_at ?? null,
      durationSeconds: response?.duration_seconds ?? null,
      questionCount: response?.question_count ?? null,
      // The stored counts are what the client observed at submit time; falling
      // back to a recount keeps pre-metadata rows usable instead of blank.
      answeredCount: response?.answered_count ?? (response ? answeredFromCells : null),
      skippedCount: cellList.filter((cell) => cell.skipped).length,
      completionPct: toNumber(response?.completion_pct),
      answers: cells,
    };
  });

  return { rows, questions, surveys, events };
}

async function fetchSurveys(surveyIds: string[]) {
  return pageAllIn<{ id: string; title_en: string; title_te: string | null }>(surveyIds, (chunk, from, to) =>
    db.from("surveys").select("id, title_en, title_te").in("id", chunk).order("id").range(from, to),
  );
}

/**
 * Questions for every survey involved, plus their options for label resolution.
 *
 * Ordered by survey then order_index so the matrix columns of one instrument stay
 * contiguous even when an export spans two surveys — a reader scrolling right
 * should never find instrument A resuming after instrument B.
 */
async function fetchQuestions(surveyIds: string[]): Promise<SurveyQuestion[]> {
  const questions = await pageAllIn<Omit<SurveyQuestion, "options">>(surveyIds, (chunk, from, to) =>
    db
      .from("survey_questions")
      .select("id, survey_id, order_index, kind, prompt_en, prompt_te, required, origin, source_ref, section_id")
      .in("survey_id", chunk)
      .order("order_index")
      .order("id")
      .range(from, to),
  );
  if (!questions.length) return [];

  const options = await pageAllIn<SurveyOption>(
    questions.map((q) => q.id),
    (chunk, from, to) =>
      db
        .from("survey_question_options")
        .select("id, question_id, order_index, label_en, label_te")
        .in("question_id", chunk)
        .order("order_index")
        .order("id")
        .range(from, to),
  );

  const optionsByQuestion = new Map<string, SurveyOption[]>();
  for (const o of options) {
    const bucket = optionsByQuestion.get(o.question_id) ?? [];
    bucket.push(o);
    optionsByQuestion.set(o.question_id, bucket);
  }

  const surveyRank = new Map(surveyIds.map((id, i) => [id, i]));
  return questions
    .map((q) => ({ ...q, options: optionsByQuestion.get(q.id) ?? [] }))
    .sort((a, b) => {
      const bySurvey = (surveyRank.get(a.survey_id) ?? 0) - (surveyRank.get(b.survey_id) ?? 0);
      return bySurvey !== 0 ? bySurvey : a.order_index - b.order_index;
    });
}

function describeDetail(detail: unknown): string {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  const entries = Object.entries(detail as Record<string, unknown>).filter(([, v]) => v != null && v !== "");
  if (!entries.length) return "";
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`).join(", ");
}

function toCell(question: SurveyQuestion, a: RawAnswer): FamilyAnswerCell {
  return {
    questionId: a.question_id,
    display: displayValue(question, a),
    numeric: numericValue(question, a),
    emoji: a.emoji ?? null,
    skipped: !!a.skipped,
    edited: !!a.edited,
    voiceUsed: !!a.voice_used,
    secondsSpent: a.seconds_spent ?? null,
    answeredAt: a.answered_at ?? null,
  };
}

function displayValue(question: SurveyQuestion, a: RawAnswer): string {
  if (a.skipped) return SKIPPED_CELL;
  if (Array.isArray(a.value_json)) {
    // Semicolons, not commas: option labels routinely contain commas, and this
    // sheet gets re-saved as CSV by at least one analyst on every project.
    return (a.value_json as unknown[]).map((v) => labelForValue(question, String(v))).join("; ");
  }
  if (a.value_int != null) return labelForValue(question, String(a.value_int));
  if (a.value_text != null) {
    return CODED_KINDS.includes(question.kind) ? labelForValue(question, a.value_text) : a.value_text;
  }
  return "";
}

function numericValue(question: SurveyQuestion, a: RawAnswer): number | null {
  if (a.skipped) return null;
  if (a.value_int != null) return a.value_int;
  if (question.kind === "likert5" || question.kind === "rating5") {
    const n = Number(a.value_text);
    return a.value_text != null && Number.isFinite(n) ? n : null;
  }
  return null;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/**
 * "4m 12s" / "—". Delegates to the reports helper so a duration reads identically
 * in a stat tile and in the workbook — two spellings of the same number is how a
 * reviewer ends up asking which one is right.
 */
export function formatDurationHuman(seconds: number | null): string {
  return formatDuration(seconds);
}

const STATUS_LABELS: Record<FamilyCaseStatus, string> = {
  not_started: "Not started",
  opened: "Opened",
  in_progress: "In progress",
  completed: "Completed",
  expired: "Expired",
  reopened: "Reopened",
};

function languageLabel(code: string): string {
  return code === "te" ? "Telugu" : "English";
}

/** Excel's 1-based column index as its letter — A, B … AA, AB. The codebook's join key. */
function columnLetter(index: number): string {
  let n = index;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/**
 * An SPSS/R-safe variable name: letter first, letters/digits/underscore after,
 * 31 characters max. Prefixed with the question number so the name still sorts
 * and joins to the matrix even when two prompts slugify to the same stem, and
 * deduplicated with a numeric suffix because a duplicate variable name silently
 * drops a column in `haven::read_sav` rather than erroring.
 */
function variableNameFor(number: number, prompt: string, used: Set<string>): string {
  const stem = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  let base = (stem ? `Q${number}_${stem}` : `Q${number}`).slice(0, 31).replace(/_+$/, "");
  if (!/^[A-Za-z]/.test(base)) base = `Q${number}`;

  let name = base;
  for (let n = 2; used.has(name); n++) {
    const suffix = `_${n}`;
    name = `${base.slice(0, 31 - suffix.length).replace(/_+$/, "")}${suffix}`;
  }
  used.add(name);
  return name;
}

const LIKERT_CODES = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

/**
 * The value list — "1=Agree; 2=Disagree".
 *
 * Codes are positional and 1-based for every kind, including the ones stored as
 * option uuids or as "yes"/"no". The matrix holds LABELS, so this is the
 * recoding instruction an analyst applies once: it has to be stable and
 * mechanical, and a position is both. The database's own identifiers are
 * deliberately not exposed here — a uuid in a codebook helps nobody and would
 * change if the instrument were ever re-seeded.
 */
function optionsSummary(question: SurveyQuestion): string {
  const codes = (labels: string[]) => labels.map((label, i) => `${i + 1}=${label}`).join("; ");
  if (question.kind === "likert5") return codes(LIKERT_CODES);
  if (question.kind === "rating5") return codes(["1 star", "2 stars", "3 stars", "4 stars", "5 stars"]);
  if (question.kind === "yes_no") return codes(["Yes", "No"]);
  if (!question.options.length) return "";
  return codes(question.options.map((o) => o.label_en));
}

function toDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Local calendar date — `toISOString()` would name the file after UTC's day. */
function todayStamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// ---------------------------------------------------------------------------
// Workbook
// ---------------------------------------------------------------------------

interface MatrixColumn {
  question: SurveyQuestion;
  /** 1-based position among the question columns. */
  number: number;
  /** 1-based position in the Families sheet, leading columns included. */
  sheetIndex: number;
  header: string;
  variableName: string;
}

/** Identity, then context, then session metrics — the order a reader scans in. */
const LEADING_COLUMNS: { header: string; width: number }[] = [
  { header: "Reference ID", width: 16 },
  { header: "Family Head", width: 24 },
  { header: "Deceased Person", width: 24 },
  { header: "Relationship", width: 14 },
  { header: "Phone", width: 14 },
  { header: "District", width: 16 },
  { header: "Village", width: 18 },
  { header: "Survey", width: 28 },
  { header: "Language", width: 11 },
  { header: "Officer", width: 24 },
  { header: "Status", width: 13 },
  { header: "Created", width: 18 },
  { header: "Submitted", width: 18 },
  { header: "Duration (seconds)", width: 15 },
  { header: "Duration (readable)", width: 16 },
  { header: "Answered", width: 11 },
  { header: "Skipped", width: 10 },
  { header: "Completion %", width: 13 },
];

const DATE_FORMAT = "yyyy-mm-dd hh:mm";
const MAX_WIDTH = 46;

type CellValue = string | number | boolean | Date | null;

/**
 * The research workbook: a matrix, a codebook, a tidy table and an audit trail.
 *
 * Sheet 1 is deliberately the dumbest possible thing — one header row, one row
 * per family, one column per question, nothing merged, nothing styled into
 * meaning. Every rectangular reader ever written (pandas.read_excel,
 * readxl::read_excel, SPSS's Excel import, Power BI's) can consume it without
 * being told anything. The cleverness lives in the other three sheets, where it
 * cannot break a parse.
 */
export async function buildFamilyResearchWorkbook(input: FamilyResearchData): Promise<Blob> {
  // The namespace, not `.default`. This project compiles without
  // `esModuleInterop`, and because this module also imports exceljs types
  // statically, TS resolves the real declaration file — which has named exports
  // and no default. Destructuring `default` here is a compile error even though
  // the same line works in exportExcel.ts, which never forces that resolution.
  const ExcelJS = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Jeevana Insight";
  wb.created = new Date();

  const usedNames = new Set<string>();
  const columns: MatrixColumn[] = input.questions.map((question, i) => ({
    question,
    number: i + 1,
    sheetIndex: LEADING_COLUMNS.length + i + 1,
    header: `Q${i + 1}. ${question.prompt_en || "(untitled question)"}`,
    variableName: variableNameFor(i + 1, question.prompt_en || "", usedNames),
  }));

  buildFamiliesSheet(wb, input.rows, columns);
  buildCodebookSheet(wb, columns, input.surveys);
  buildAnswerDetailSheet(wb, input.rows, columns);
  buildCaseLogSheet(wb, input.events);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function buildFamiliesSheet(wb: Workbook, rows: FamilyExportRow[], columns: MatrixColumn[]) {
  // xSplit: 1 pins the Reference ID column, ySplit: 1 pins the header. At 128+
  // columns a reader who scrolls right otherwise has no idea whose row they are on.
  const sheet = wb.addWorksheet("Families", { views: [{ state: "frozen", xSplit: 1, ySplit: 1 }] });

  sheet.columns = [
    ...LEADING_COLUMNS.map((c) => ({ header: c.header, width: c.width })),
    // Width is capped so 128 columns stay navigable. Capping a COLUMN WIDTH never
    // truncates a value — Excel clips the display, the cell keeps the full string.
    // Truncating the value itself would be data loss and is never done.
    ...columns.map((c) => ({
      header: c.header,
      width: Math.min(MAX_WIDTH, Math.max(18, Math.ceil(c.header.length / 2.2))),
    })),
  ];

  for (const row of rows) {
    const values: CellValue[] = [
      row.referenceId,
      row.familyHead,
      row.deceasedName,
      row.relationship,
      row.phone,
      row.district,
      row.village,
      row.surveyTitle,
      languageLabel(row.language),
      row.officer,
      STATUS_LABELS[row.status] ?? row.status,
      // Real Date objects, not pre-formatted strings: SPSS and R read a
      // stringified timestamp as a factor level, and every date arithmetic in
      // the analysis then has to start with a parse the exporter could have
      // avoided. Same reasoning for the four numeric columns that follow.
      toDate(row.createdAt),
      toDate(row.submittedAt),
      row.durationSeconds,
      formatDurationHuman(row.durationSeconds),
      row.answeredCount,
      row.skippedCount,
      row.completionPct,
    ];

    for (const col of columns) {
      const cell = row.answers[col.question.id];
      // Three states, and the difference between the last two is the whole
      // reason the per-answer metadata exists:
      //   answered      -> the resolved value
      //   skipped       -> [SKIPPED], an observed refusal
      //   never reached -> "", including every question of a survey this family
      //                    was not assigned. Absence of evidence, not evidence.
      values.push(cell ? cell.display : "");
    }

    sheet.addRow(values);
  }

  // Numeric coding lives in the Codebook and the Answer detail sheet, not here.
  // The [SKIPPED] sentinel makes every question column a text column by
  // construction, so writing Likert codes as numbers would only produce a
  // mixed-type column that pandas reads as `object` anyway — worse than a
  // consistently textual one an analyst recodes in a single documented step.
  numericColumn(sheet, 14, "0");
  numericColumn(sheet, 16, "0");
  numericColumn(sheet, 17, "0");
  numericColumn(sheet, 18, "0.00");
  dateColumn(sheet, 12);
  dateColumn(sheet, 13);

  styleHeader(sheet, LEADING_COLUMNS.length + columns.length);
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: LEADING_COLUMNS.length + columns.length },
  };
}

/**
 * Without this sheet a 128-column matrix is readable only by whoever built it.
 *
 * The variable names could have been a second header row on the Families sheet,
 * which is what a lot of exports do. They are not, because a two-row header
 * stops the matrix being rectangular: `read_excel` would take row 2 as the first
 * observation and every column's type would come back as character. One header
 * row on the matrix, the mapping over here.
 */
function buildCodebookSheet(
  wb: Workbook,
  columns: MatrixColumn[],
  surveys: { id: string; title_en: string; title_te: string | null }[],
) {
  const sheet = wb.addWorksheet("Codebook", { views: [{ state: "frozen", ySplit: 1 }] });
  const titles = new Map(surveys.map((s) => [s.id, s.title_en]));

  sheet.columns = [
    { header: "Column", width: 9 },
    { header: "Column index", width: 13 },
    { header: "Variable name", width: 34 },
    { header: "Question no", width: 12 },
    { header: "Survey", width: 28 },
    { header: "Prompt (EN)", width: MAX_WIDTH },
    { header: "Prompt (TE)", width: MAX_WIDTH },
    { header: "Kind", width: 16 },
    { header: "Options", width: MAX_WIDTH },
  ];

  for (const col of columns) {
    sheet.addRow([
      columnLetter(col.sheetIndex),
      col.sheetIndex,
      col.variableName,
      col.number,
      titles.get(col.question.survey_id) ?? "",
      col.question.prompt_en,
      col.question.prompt_te ?? "",
      col.question.kind,
      optionsSummary(col.question),
    ] as CellValue[]);
  }

  numericColumn(sheet, 2, "0");
  numericColumn(sheet, 4, "0");
  sheet.getColumn(6).alignment = { vertical: "top", wrapText: true };
  sheet.getColumn(7).alignment = { vertical: "top", wrapText: true };
  sheet.getColumn(9).alignment = { vertical: "top", wrapText: true };
  styleHeader(sheet, 9);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
}

/**
 * The same data in long/tidy form — one row per (family, question).
 *
 * This is the shape modelling actually wants: it is what `pivot_longer` /
 * `pd.melt` produces from sheet 1, and it is the only shape that can carry the
 * per-answer metadata at all, since dwell time and voice use have nowhere to
 * live in a wide matrix. Shipping it saves every analyst on the project doing
 * the identical reshape, slightly differently.
 */
function buildAnswerDetailSheet(wb: Workbook, rows: FamilyExportRow[], columns: MatrixColumn[]) {
  const sheet = wb.addWorksheet("Answer detail", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Reference ID", width: 16 },
    { header: "Question No", width: 12 },
    { header: "Variable name", width: 34 },
    { header: "Question", width: MAX_WIDTH },
    { header: "Answer", width: MAX_WIDTH },
    { header: "Numeric value", width: 13 },
    { header: "Emoji", width: 8 },
    { header: "Skipped", width: 10 },
    { header: "Edited", width: 9 },
    { header: "Voice used", width: 11 },
    { header: "Seconds spent", width: 14 },
    { header: "Answered at", width: 18 },
  ];

  for (const row of rows) {
    for (const col of columns) {
      const cell = row.answers[col.question.id];
      if (!cell) continue; // never reached — a long table records events, not absences
      sheet.addRow([
        row.referenceId,
        col.number,
        col.variableName,
        col.question.prompt_en,
        cell.skipped ? SKIPPED_CELL : cell.display,
        cell.numeric,
        cell.emoji ?? "",
        // Real booleans, not "Yes"/"No": every reader maps an Excel logical to
        // its own native logical type, and a string needs recoding in each one.
        cell.skipped,
        cell.edited,
        cell.voiceUsed,
        cell.secondsSpent,
        toDate(cell.answeredAt),
      ] as CellValue[]);
    }
  }

  numericColumn(sheet, 2, "0");
  numericColumn(sheet, 6, "0.##");
  numericColumn(sheet, 11, "0");
  dateColumn(sheet, 12);
  sheet.getColumn(4).alignment = { vertical: "top", wrapText: true };
  sheet.getColumn(5).alignment = { vertical: "top", wrapText: true };
  styleHeader(sheet, 12);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };
}

/** The provenance trail: who created, reissued, opened and submitted what, and when. */
function buildCaseLogSheet(wb: Workbook, events: FamilyEventExportRow[]) {
  const sheet = wb.addWorksheet("Case log", { views: [{ state: "frozen", ySplit: 1 }] });

  sheet.columns = [
    { header: "Reference ID", width: 16 },
    { header: "Event", width: 20 },
    { header: "Actor", width: 28 },
    { header: "Detail", width: MAX_WIDTH },
    { header: "When", width: 18 },
  ];

  for (const e of events) {
    sheet.addRow([e.referenceId, e.event, e.actor, e.detail, toDate(e.createdAt)] as CellValue[]);
  }

  dateColumn(sheet, 5);
  sheet.getColumn(4).alignment = { vertical: "top", wrapText: true };
  styleHeader(sheet, 5);
  sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 5 } };
}

function numericColumn(sheet: Worksheet, index: number, numFmt: string) {
  const col = sheet.getColumn(index);
  col.numFmt = numFmt;
  col.alignment = { horizontal: "right", vertical: "middle" };
}

function dateColumn(sheet: Worksheet, index: number) {
  const col = sheet.getColumn(index);
  col.numFmt = DATE_FORMAT;
  col.alignment = { horizontal: "right", vertical: "middle" };
}

/**
 * Header only. No zebra banding anywhere in this workbook: alternating fills
 * make a reader track the stripe rather than the row, and at 128 columns that
 * is precisely the mistake — reading the right band on the wrong family.
 * Applied last, so the column-level alignment set above cannot overwrite it.
 */
function styleHeader(sheet: Worksheet, columnCount: number) {
  const header = sheet.getRow(1);
  header.height = 34;
  for (let i = 1; i <= columnCount; i++) {
    const cell = header.getCell(i);
    cell.font = { bold: true, color: { argb: HEADER_FONT } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: "middle", wrapText: true };
  }
}

// ---------------------------------------------------------------------------
// The one call the admin page makes
// ---------------------------------------------------------------------------

/**
 * Export the cases currently on screen.
 *
 * Takes the rows the admin can see rather than re-querying a filter, so what
 * lands in the workbook is exactly what they were looking at when they pressed
 * the button. An empty selection is a legitimate answer and produces a workbook
 * with headers and no data rows — throwing would make an honest "nothing matched"
 * look like a broken export.
 */
export async function exportFamilyCasesWorkbook(
  rows: FamilyCaseRow[],
  opts: { fileName?: string } = {},
): Promise<void> {
  const data = await loadFamilyResearchData(rows.map((r) => r.id));
  const blob = await buildFamilyResearchWorkbook(data);
  const stem = opts.fileName ? slugifyFilename(opts.fileName) : `jeevana-family-research-${todayStamp()}`;
  downloadBlob(blob, `${stem}.xlsx`);
}
