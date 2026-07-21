import { customAlphabet } from "nanoid";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AnswerMeta } from "@/lib/assessmentSession";
import { logAudit } from "@/lib/audit";

export type QuestionKind = Database["public"]["Enums"]["question_kind"];
export type SurveyStatus = Database["public"]["Enums"]["survey_status"];
export type QuestionOrigin = Database["public"]["Enums"]["question_origin"];

export const QUESTION_KINDS: { value: QuestionKind; label: string; hasOptions: boolean }[] = [
  { value: "multiple_choice", label: "Multiple choice", hasOptions: true },
  { value: "checkboxes", label: "Checkboxes", hasOptions: true },
  { value: "likert5", label: "Likert scale (5-point)", hasOptions: false },
  { value: "yes_no", label: "Yes / No", hasOptions: false },
  { value: "rating5", label: "Rating (1â€“5 stars)", hasOptions: false },
  { value: "short_text", label: "Short text", hasOptions: false },
  { value: "long_text", label: "Long text", hasOptions: false },
  { value: "dropdown", label: "Dropdown", hasOptions: true },
];

export interface SurveyOption {
  id: string;
  question_id: string;
  order_index: number;
  label_en: string;
  label_te: string | null;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  order_index: number;
  kind: QuestionKind;
  prompt_en: string;
  prompt_te: string | null;
  required: boolean;
  origin: QuestionOrigin;
  source_ref: string | null;
  /** null = ungrouped; questions predating sections all start here. */
  section_id: string | null;
  options: SurveyOption[];
}

export interface SurveySection {
  id: string;
  survey_id: string;
  order_index: number;
  title_en: string;
  title_te: string | null;
  description_en: string | null;
  description_te: string | null;
  collapsed: boolean;
}

export interface QuestionDraft {
  id: string;
  prompt_en: string;
  prompt_te?: string;
  kind: QuestionKind;
  options: string[];
  duplicateOfPrompt?: string;
  include: boolean;
}

export interface Survey {
  id: string;
  title_en: string;
  title_te: string | null;
  description_en: string | null;
  description_te: string | null;
  status: SurveyStatus;
  slug: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

export interface SurveyWithCounts extends Survey {
  question_count: number;
  response_count: number;
}

const genSlug = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 7);

// ---------------------------------------------------------------------------
// Surveys
// ---------------------------------------------------------------------------

export async function listSurveys(): Promise<SurveyWithCounts[]> {
  const [{ data: surveys, error }, { data: questions }, { data: responses }] = await Promise.all([
    supabase.from("surveys").select("*").order("created_at", { ascending: false }),
    supabase.from("survey_questions").select("id, survey_id"),
    supabase.from("survey_responses").select("id, survey_id"),
  ]);
  if (error) throw error;
  const qCount = new Map<string, number>();
  for (const q of questions ?? []) qCount.set(q.survey_id, (qCount.get(q.survey_id) ?? 0) + 1);
  const rCount = new Map<string, number>();
  for (const r of responses ?? []) rCount.set(r.survey_id, (rCount.get(r.survey_id) ?? 0) + 1);
  return (surveys ?? []).map((s) => ({
    ...(s as Survey),
    question_count: qCount.get(s.id) ?? 0,
    response_count: rCount.get(s.id) ?? 0,
  }));
}

export async function createSurvey(input: { title_en: string; title_te?: string; description_en?: string; description_te?: string }) {
  const { data: user } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("surveys")
    .insert({
      title_en: input.title_en,
      title_te: input.title_te || null,
      description_en: input.description_en || null,
      description_te: input.description_te || null,
      created_by: user.user?.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  await logAudit("survey.create", "survey", data.id, { title: input.title_en });
  return data.id as string;
}

export async function updateSurveyMeta(id: string, patch: Partial<Pick<Survey, "title_en" | "title_te" | "description_en" | "description_te">>) {
  const { error } = await supabase.from("surveys").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSurvey(id: string) {
  const { error } = await supabase.from("surveys").delete().eq("id", id);
  if (error) throw error;
  await logAudit("survey.delete", "survey", id, {});
}

export async function publishSurvey(id: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = genSlug();
    const { error } = await supabase
      .from("surveys")
      .update({ status: "published", slug, published_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) {
      await logAudit("survey.publish", "survey", id, { slug });
      return slug;
    }
    if (!/duplicate key|unique/i.test(error.message)) throw error;
  }
  throw new Error("Could not generate a unique link. Please try again.");
}

/**
 * Mint a fresh slug for an already-published survey, retiring the old one.
 *
 * The slug IS the access credential, so this is the platform's only revocation
 * mechanism: if a link leaks — forwarded outside the intended families, posted
 * in a group chat — rotating it is what closes the door. The cost is that every
 * QR already printed or handed out stops working, which is why the caller
 * confirms first and the audit log records both slugs.
 */
export async function regenerateSurveyLink(id: string, previousSlug: string | null): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = genSlug();
    const { error } = await supabase.from("surveys").update({ slug }).eq("id", id);
    if (!error) {
      await logAudit("survey.link.regenerate", "survey", id, { from: previousSlug, to: slug });
      return slug;
    }
    if (!/duplicate key|unique/i.test(error.message)) throw error;
  }
  throw new Error("Could not generate a unique link. Please try again.");
}

export async function closeSurvey(id: string) {
  const { error } = await supabase.from("surveys").update({ status: "closed" }).eq("id", id);
  if (error) throw error;
  await logAudit("survey.close", "survey", id, {});
}

export async function reopenSurvey(id: string) {
  const { error } = await supabase.from("surveys").update({ status: "published" }).eq("id", id);
  if (error) throw error;
  await logAudit("survey.reopen", "survey", id, {});
}

// ---------------------------------------------------------------------------
// Survey + questions (admin, full detail)
// ---------------------------------------------------------------------------

export async function getSurveyWithQuestions(
  id: string,
): Promise<{ survey: Survey; questions: SurveyQuestion[]; sections: SurveySection[] } | null> {
  const { data: survey, error: sErr } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
  if (sErr) throw sErr;
  if (!survey) return null;
  const [questions, sections] = await Promise.all([loadQuestions(id), listSections(id)]);
  return { survey: survey as Survey, questions, sections };
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function listSections(surveyId: string): Promise<SurveySection[]> {
  const { data, error } = await supabase
    .from("survey_sections")
    .select("*")
    .eq("survey_id", surveyId)
    .order("order_index");
  if (error) throw error;
  return (data ?? []) as SurveySection[];
}

export async function createSection(surveyId: string, orderIndex: number, title_en = "Untitled section"): Promise<SurveySection> {
  const { data, error } = await supabase
    .from("survey_sections")
    .insert({ survey_id: surveyId, order_index: orderIndex, title_en })
    .select("*")
    .single();
  if (error) throw error;
  return data as SurveySection;
}

export async function updateSection(
  id: string,
  patch: Partial<Pick<SurveySection, "title_en" | "title_te" | "description_en" | "description_te" | "collapsed">>,
) {
  const { error } = await supabase.from("survey_sections").update(patch).eq("id", id);
  if (error) throw error;
}

/** Questions in the section are released to Ungrouped by the FK's ON DELETE SET NULL. */
export async function deleteSection(id: string) {
  const { error } = await supabase.from("survey_sections").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderSections(orderedIds: string[]) {
  const { error } = await supabase.rpc("reorder_survey_sections", {
    items: orderedIds.map((id, order_index) => ({ id, order_index })),
  });
  if (error) throw error;
}

async function loadQuestions(surveyId: string): Promise<SurveyQuestion[]> {
  const { data: qs, error: qErr } = await supabase
    .from("survey_questions")
    .select("*")
    .eq("survey_id", surveyId)
    .order("order_index");
  if (qErr) throw qErr;
  const ids = (qs ?? []).map((q) => q.id);
  let options: SurveyOption[] = [];
  if (ids.length) {
    const { data: opts, error: oErr } = await supabase
      .from("survey_question_options")
      .select("*")
      .in("question_id", ids)
      .order("order_index");
    if (oErr) throw oErr;
    options = (opts ?? []) as SurveyOption[];
  }
  return (qs ?? []).map((q) => ({
    ...(q as Omit<SurveyQuestion, "options">),
    options: options.filter((o) => o.question_id === q.id),
  }));
}

export async function createQuestion(
  surveyId: string,
  kind: QuestionKind = "short_text",
  opts?: { origin?: QuestionOrigin; prompt_en?: string; prompt_te?: string; section_id?: string | null; order_index?: number },
): Promise<SurveyQuestion> {
  let nextIndex = opts?.order_index;
  if (nextIndex === undefined) {
    const { data: existing } = await supabase
      .from("survey_questions")
      .select("order_index")
      .eq("survey_id", surveyId)
      .order("order_index", { ascending: false })
      .limit(1);
    nextIndex = existing && existing.length ? existing[0].order_index + 1 : 0;
  }
  const { data, error } = await supabase
    .from("survey_questions")
    .insert({
      survey_id: surveyId,
      kind,
      order_index: nextIndex,
      prompt_en: opts?.prompt_en ?? "",
      prompt_te: opts?.prompt_te ?? null,
      required: true,
      origin: opts?.origin ?? "manual",
      section_id: opts?.section_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  const kindMeta = QUESTION_KINDS.find((k) => k.value === kind);
  let options: SurveyOption[] = [];
  if (kindMeta?.hasOptions) {
    const { data: opts, error: oErr } = await supabase
      .from("survey_question_options")
      .insert([
        { question_id: data.id, order_index: 0, label_en: "Option 1" },
        { question_id: data.id, order_index: 1, label_en: "Option 2" },
      ])
      .select("*");
    if (oErr) throw oErr;
    options = (opts ?? []) as SurveyOption[];
  }
  return { ...(data as Omit<SurveyQuestion, "options">), options };
}

// ---------------------------------------------------------------------------
// Bulk import (PDF extraction) â€” always appends after the current last
// question, so uploading several PDFs in sequence never overwrites earlier
// ones. Each call creates one import_batches row for traceability.
// ---------------------------------------------------------------------------

export async function importQuestions(
  surveyId: string,
  drafts: QuestionDraft[],
  sourceType: Extract<QuestionOrigin, "pdf" | "voice">,
  fileName?: string,
): Promise<SurveyQuestion[]> {
  if (!drafts.length) return [];

  const { data: user } = await supabase.auth.getUser();
  const { data: batch, error: bErr } = await supabase
    .from("import_batches")
    .insert({ survey_id: surveyId, source_type: sourceType, file_name: fileName ?? null, question_count: drafts.length, created_by: user.user?.id })
    .select("id")
    .single();
  if (bErr) throw bErr;

  const { data: existing } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: false })
    .limit(1);
  const nextIndex = existing && existing.length ? existing[0].order_index + 1 : 0;

  const { data: inserted, error: qErr } = await supabase
    .from("survey_questions")
    .insert(drafts.map((draft, offset) => ({
      survey_id: surveyId,
      kind: draft.kind,
      order_index: nextIndex + offset,
      prompt_en: draft.prompt_en,
      prompt_te: draft.prompt_te || null,
      required: true,
      origin: sourceType,
      source_ref: batch.id,
    })))
    .select("*")
    .order("order_index");
  if (qErr) throw qErr;

  const questionRows = (inserted ?? []) as Omit<SurveyQuestion, "options">[];
  const optionRows = questionRows.flatMap((question, index) =>
    drafts[index].options.map((label, order_index) => ({ question_id: question.id, order_index, label_en: label })),
  );
  let options: SurveyOption[] = [];
  if (optionRows.length) {
    const { data: insertedOptions, error: oErr } = await supabase
      .from("survey_question_options")
      .insert(optionRows)
      .select("*");
    if (oErr) throw oErr;
    options = (insertedOptions ?? []) as SurveyOption[];
  }

  const created = questionRows.map((question) => ({
    ...question,
    options: options.filter((option) => option.question_id === question.id),
  }));

  await logAudit(`question.import.${sourceType}`, "survey", surveyId, { count: created.length, file_name: fileName });
  return created;
}

export async function duplicateQuestion(q: SurveyQuestion): Promise<SurveyQuestion> {
  const { data: existing } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("survey_id", q.survey_id)
    .order("order_index", { ascending: false })
    .limit(1);
  const nextIndex = existing && existing.length ? existing[0].order_index + 1 : 0;
  const { data, error } = await supabase
    .from("survey_questions")
    .insert({
      survey_id: q.survey_id,
      kind: q.kind,
      order_index: nextIndex,
      prompt_en: `${q.prompt_en} (copy)`,
      prompt_te: q.prompt_te,
      required: q.required,
      section_id: q.section_id,
    })
    .select("*")
    .single();
  if (error) throw error;
  let options: SurveyOption[] = [];
  if (q.options.length) {
    const { data: opts, error: oErr } = await supabase
      .from("survey_question_options")
      .insert(q.options.map((o) => ({ question_id: data.id, order_index: o.order_index, label_en: o.label_en, label_te: o.label_te })))
      .select("*");
    if (oErr) throw oErr;
    options = (opts ?? []) as SurveyOption[];
  }
  return { ...(data as Omit<SurveyQuestion, "options">), options };
}

export async function updateQuestion(
  id: string,
  patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required" | "kind" | "section_id">>,
) {
  const { error } = await supabase.from("survey_questions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteQuestion(id: string) {
  const { error } = await supabase.from("survey_questions").delete().eq("id", id);
  if (error) throw error;
}

/**
 * One round trip for the whole list. `placements` carries section_id too, so a
 * drag that moves a question into another section persists both facts at once.
 */
export async function reorderQuestions(placements: { id: string; section_id: string | null }[]) {
  const { error } = await supabase.rpc("reorder_survey_questions", {
    items: placements.map((p, order_index) => ({ id: p.id, order_index, section_id: p.section_id })),
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export async function addOption(questionId: string, nextIndex: number): Promise<SurveyOption> {
  const { data, error } = await supabase
    .from("survey_question_options")
    .insert({ question_id: questionId, order_index: nextIndex, label_en: `Option ${nextIndex + 1}` })
    .select("*")
    .single();
  if (error) throw error;
  return data as SurveyOption;
}

export async function updateOption(id: string, patch: Partial<Pick<SurveyOption, "label_en" | "label_te">>) {
  const { error } = await supabase.from("survey_question_options").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOption(id: string) {
  const { error } = await supabase.from("survey_question_options").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderOptions(orderedIds: string[]) {
  const { error } = await supabase.rpc("reorder_survey_options", {
    items: orderedIds.map((id, order_index) => ({ id, order_index })),
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Public (parent) access
// ---------------------------------------------------------------------------

export type PublicSurveyState =
  | { kind: "not_found" }
  | { kind: "closed"; survey: Survey }
  | { kind: "open"; survey: Survey; questions: SurveyQuestion[] };

export async function getPublicSurvey(slug: string): Promise<PublicSurveyState> {
  const { data: survey, error } = await supabase.from("surveys").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!survey) return { kind: "not_found" };
  if (survey.status !== "published") return { kind: "closed", survey: survey as Survey };
  const questions = await loadQuestions(survey.id);
  return { kind: "open", survey: survey as Survey, questions };
}

export type AnswerValue = string | number | string[] | null;

/** Fire-and-forget page-view counter, used only for the completion-rate metric. Never blocks the respondent. */
export function trackSurveyView(surveyId: string) {
  supabase.from("survey_views").insert({ survey_id: surveyId }).then(() => {});
}

/**
 * Submissions go through the `submit-response` edge function rather than a
 * direct table insert â€” anon INSERT is revoked on survey_responses/
 * survey_answers so this is the only write path, letting the function
 * rate-limit by a hashed IP fingerprint before anything is persisted.
 */
export interface SubmissionContext {
  /** Per-answer metadata: emoji seen, dwell time, skipped, edited, voice used. */
  meta?: Record<string, AnswerMeta>;
  startedAt?: Date;
  /** Size of the instrument as served, so completion is stored, not inferred. */
  questionCount?: number;
  answeredCount?: number;
}

export async function submitSurveyResponse(
  surveyId: string,
  language: string,
  answers: Record<string, AnswerValue>,
  context: SubmissionContext = {},
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("submit-response", {
    body: {
      survey_id: surveyId,
      language,
      answers,
      meta: context.meta ?? {},
      started_at: context.startedAt?.toISOString(),
      question_count: context.questionCount,
      answered_count: context.answeredCount,
    },
  });
  if (error) throw new Error(error.message || "Could not submit your response. Please try again.");
  if (data?.error) throw new Error(data.error);
  return data.id as string;
}



