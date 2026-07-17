import { memo, useCallback, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { QuestionRenderer } from "@/components/survey/QuestionRenderer";
import { useBuilderStore, useQuestion, selectVisibleIds } from "@/stores/builderStore";
import type { AnswerValue } from "@/lib/surveys";
import type { LangMode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One preview row, subscribed to its own question — mirrors QuestionRow so that
 * editing question 3 repaints only preview row 3, not the whole pane.
 */
const PreviewRow = memo(function PreviewRow({
  id,
  index,
  mode,
  value,
  onChange,
}: {
  id: string;
  index: number;
  mode: LangMode;
  value: AnswerValue;
  onChange: (id: string, v: AnswerValue) => void;
}) {
  const q = useQuestion(id);
  const handle = useCallback((v: AnswerValue) => onChange(id, v), [onChange, id]);
  if (!q) return null;
  return <QuestionRenderer question={q} mode={mode} index={index} value={value} onChange={handle} />;
});

/**
 * Live respondent-eye view, rendered from the same store the editor writes to —
 * so an edit shows up here on the same frame, with no save/refresh round trip.
 * Uses the real QuestionRenderer so what's shown is what parents actually get.
 */
export function InlinePreview({ mode }: { mode: LangMode }) {
  const visibleIds = useBuilderStore(useShallow(selectVisibleIds));
  // Individual fields, not the whole survey object: description edits shouldn't
  // invalidate the list below.
  const titleEn = useBuilderStore((s) => s.survey?.title_en);
  const descriptionEn = useBuilderStore((s) => s.survey?.description_en);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});

  const onChange = useCallback((id: string, v: AnswerValue) => {
    setAnswers((a) => ({ ...a, [id]: v }));
  }, []);

  if (titleEn === undefined) return null;

  return (
    <div className="space-y-4">
      <div className="px-1">
        <h3 className={cn("t-title", !titleEn && "text-muted-foreground/60")}>{titleEn || "Untitled survey"}</h3>
        {descriptionEn && <p className="mt-1 t-body text-muted-foreground">{descriptionEn}</p>}
      </div>
      {visibleIds.length === 0 ? (
        <p className="rounded-surface border border-dashed border-border/70 px-4 py-10 text-center t-caption text-muted-foreground">
          Questions appear here as you write them.
        </p>
      ) : (
        visibleIds.map((id, i) => (
          <PreviewRow key={id} id={id} index={i} mode={mode} value={answers[id] ?? null} onChange={onChange} />
        ))
      )}
    </div>
  );
}
