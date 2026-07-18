import { supabase } from "@/integrations/supabase/client";
import { getSurveyWithQuestions } from "@/lib/surveys";
import { labelForValue } from "@/lib/analytics";
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
  language: string;
}

export async function listResponses(): Promise<ResponseListItem[]> {
  const [{ data: responses, error }, { data: surveys }] = await Promise.all([
    supabase
      .from("survey_responses")
      .select("id, survey_id, submitted_at, language")
      .order("submitted_at", { ascending: false })
      .limit(500),
    supabase.from("surveys").select("id, title_en"),
  ]);
  if (error) throw error;

  const titleById = new Map((surveys ?? []).map((s) => [s.id, s.title_en]));
  return (responses ?? []).map((r) => ({
    id: r.id,
    referenceId: formatReferenceId(r.id),
    surveyId: r.survey_id,
    surveyTitle: titleById.get(r.survey_id) ?? "—",
    submittedAt: r.submitted_at,
    language: r.language,
  }));
}

export interface ResponseAnswer {
  questionId: string;
  prompt: string;
  answer: string | null;
}

export interface ResponseDetail {
  answered: number;
  total: number;
  answers: ResponseAnswer[];
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
    };
  });

  return {
    answered: rows.filter((r) => r.answer != null).length,
    total: rows.length,
    answers: rows,
  };
}
