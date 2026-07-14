import { supabase } from "@/integrations/supabase/client";
import type { QuestionDraft, QuestionKind, SurveyQuestion } from "@/lib/surveys";

export class ExtractionError extends Error {}

interface RawExtracted {
  prompt_en: string;
  prompt_te?: string;
  kind: QuestionKind;
  options: string[];
}

export async function extractQuestionsFromText(text: string): Promise<RawExtracted[]> {
  const { data, error } = await supabase.functions.invoke("extract-questions", { body: { text } });
  if (error) throw new ExtractionError(error.message || "AI extraction failed.");
  if (data?.error) throw new ExtractionError(data.error);
  return (data?.questions ?? []) as RawExtracted[];
}

const NON_WORD = /[^\p{L}\p{N}\s]/gu;

function normalize(s: string): string {
  return s.toLowerCase().replace(NON_WORD, "").replace(/\s+/g, " ").trim();
}

/** Cheap similarity: token-overlap ratio. Good enough to flag likely duplicates for human review — never auto-removes anything. */
function similarity(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(Boolean));
  const tb = new Set(normalize(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap++;
  return overlap / Math.max(ta.size, tb.size);
}

const DUPLICATE_THRESHOLD = 0.6;

export function toDraftsWithDuplicateCheck(raw: RawExtracted[], existing: SurveyQuestion[]): QuestionDraft[] {
  return raw.map((r, i) => {
    let bestMatch: string | undefined;
    let bestScore = 0;
    for (const q of existing) {
      const score = similarity(r.prompt_en, q.prompt_en);
      if (score > bestScore) { bestScore = score; bestMatch = q.prompt_en; }
    }
    return {
      id: `draft-${i}-${Date.now()}`,
      prompt_en: r.prompt_en,
      prompt_te: r.prompt_te,
      kind: r.kind,
      options: r.options,
      duplicateOfPrompt: bestScore >= DUPLICATE_THRESHOLD ? bestMatch : undefined,
      include: true,
    } satisfies QuestionDraft;
  });
}

/** Also flags duplicates within the batch itself (e.g. the same question repeated across pages of one PDF). */
export function flagIntraBatchDuplicates(drafts: QuestionDraft[]): QuestionDraft[] {
  return drafts.map((d, i) => {
    if (d.duplicateOfPrompt) return d;
    for (let j = 0; j < i; j++) {
      if (similarity(d.prompt_en, drafts[j].prompt_en) >= DUPLICATE_THRESHOLD) {
        return { ...d, duplicateOfPrompt: drafts[j].prompt_en };
      }
    }
    return d;
  });
}
