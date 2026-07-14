import { customAlphabet } from "nanoid";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logAudit } from "@/lib/audit";

export type QuestionKind = Database["public"]["Enums"]["question_kind"];
export type SurveyStatus = Database["public"]["Enums"]["survey_status"];
export type QuestionOrigin = Database["public"]["Enums"]["question_origin"];

export const QUESTION_KINDS: { value: QuestionKind; label: string; hasOptions: boolean }[] = [
  { value: "multiple_choice", label: "Multiple choice", hasOptions: true },
  { value: "checkboxes", label: "Checkboxes", hasOptions: true },
  { value: "likert5", label: "Likert scale (5-point)", hasOptions: false },
  { value: "yes_no", label: "Yes / No", hasOptions: false },
  { value: "rating5", label: "Rating (1–5 stars)", hasOptions: false },
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
  options: SurveyOption[];
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

export async function getSurveyWithQuestions(id: string): Promise<{ survey: Survey; questions: SurveyQuestion[] } | null> {
  const { data: survey, error: sErr } = await supabase.from("surveys").select("*").eq("id", id).maybeSingle();
  if (sErr) throw sErr;
  if (!survey) return null;
  const questions = await loadQuestions(id);
  return { survey: survey as Survey, questions };
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
  opts?: { origin?: QuestionOrigin; prompt_en?: string },
): Promise<SurveyQuestion> {
  const { data: existing } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: false })
    .limit(1);
  const nextIndex = existing && existing.length ? existing[0].order_index + 1 : 0;
  const { data, error } = await supabase
    .from("survey_questions")
    .insert({
      survey_id: surveyId,
      kind,
      order_index: nextIndex,
      prompt_en: opts?.prompt_en || "Untitled question",
      required: true,
      origin: opts?.origin ?? "manual",
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
// Bulk import (PDF extraction) — always appends after the current last
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
  let nextIndex = existing && existing.length ? existing[0].order_index + 1 : 0;

  const created: SurveyQuestion[] = [];
  for (const draft of drafts) {
    const { data, error } = await supabase
      .from("survey_questions")
      .insert({
        survey_id: surveyId,
        kind: draft.kind,
        order_index: nextIndex++,
        prompt_en: draft.prompt_en,
        prompt_te: draft.prompt_te || null,
        required: true,
        origin: sourceType,
        source_ref: batch.id,
      })
      .select("*")
      .single();
    if (error) throw error;

    let options: SurveyOption[] = [];
    if (draft.options.length) {
      const { data: opts, error: oErr } = await supabase
        .from("survey_question_options")
        .insert(draft.options.map((label, i) => ({ question_id: data.id, order_index: i, label_en: label })))
        .select("*");
      if (oErr) throw oErr;
      options = (opts ?? []) as SurveyOption[];
    }
    created.push({ ...(data as Omit<SurveyQuestion, "options">), options });
  }

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

export async function updateQuestion(id: string, patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required" | "kind">>) {
  const { error } = await supabase.from("survey_questions").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteQuestion(id: string) {
  const { error } = await supabase.from("survey_questions").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderQuestions(orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, index) => supabase.from("survey_questions").update({ order_index: index }).eq("id", id)));
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
  await Promise.all(orderedIds.map((id, index) => supabase.from("survey_question_options").update({ order_index: index }).eq("id", id)));
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
 * direct table insert — anon INSERT is revoked on survey_responses/
 * survey_answers so this is the only write path, letting the function
 * rate-limit by a hashed IP fingerprint before anything is persisted.
 */
export async function submitSurveyResponse(
  surveyId: string,
  language: string,
  answers: Record<string, AnswerValue>,
  startedAt?: Date,
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("submit-response", {
    body: { survey_id: surveyId, language, answers, started_at: startedAt?.toISOString() },
  });
  if (error) throw new Error(error.message || "Could not submit your response. Please try again.");
  if (data?.error) throw new Error(data.error);
  return data.id as string;
}
