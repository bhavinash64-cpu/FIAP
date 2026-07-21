import { memo, useCallback, useEffect, useRef } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { OriginBadge } from "@/components/survey/OriginBadge";
import { AutoTextarea } from "@/components/survey/builder/AutoTextarea";
import { useBuilderStore, useQuestion, selectFiltering } from "@/stores/builderStore";
import { QUESTION_KINDS, type QuestionKind } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const KIND_HAS_OPTIONS = new Set(QUESTION_KINDS.filter((k) => k.hasOptions).map((k) => k.value));

/**
 * One question, edited in place. Subscribes to its own store slice only, so a
 * keystroke here re-renders this row and nothing else on the page.
 */
export const QuestionRow = memo(function QuestionRow({ id, index }: { id: string; index: number }) {
  const q = useQuestion(id);
  const promptRef = useRef<HTMLTextAreaElement>(null);

  // Actions are stable store references — pulling them individually keeps this
  // component from re-rendering when unrelated store slices change.
  const patchQuestion = useBuilderStore((s) => s.patchQuestion);
  const setKind = useBuilderStore((s) => s.setKind);
  const duplicate = useBuilderStore((s) => s.duplicate);
  const remove = useBuilderStore((s) => s.remove);
  const addQuestion = useBuilderStore((s) => s.addQuestion);
  const addOptionTo = useBuilderStore((s) => s.addOptionTo);
  const patchOption = useBuilderStore((s) => s.patchOption);
  const removeOption = useBuilderStore((s) => s.removeOption);
  const moveOption = useBuilderStore((s) => s.moveOption);

  // Boolean selectors so a row only re-renders when ITS focused state flips (or
  // filtering toggles) — never on every add elsewhere in the list.
  const isFocused = useBuilderStore((s) => s.focusedId === id);
  const setFocused = useBuilderStore((s) => s.setFocused);
  const filtering = useBuilderStore(selectFiltering);

  // Enter-adds-the-next-question focuses that new row (the documented Notion
  // behaviour), then clears the flag so it fires exactly once.
  useEffect(() => {
    if (isFocused) {
      promptRef.current?.focus();
      setFocused(null);
    }
  }, [isFocused, setFocused]);

  // A filtered list is a subset, so a drag against a visible neighbour can't be
  // resolved into the full order without misplacing hidden rows — disable
  // reordering until the filters are cleared.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: filtering });

  const onPromptKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter adds the next question (Notion behaviour); Shift+Enter is a newline.
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        addQuestion(q?.kind ?? "short_text", q?.section_id ?? null, id);
      }
      // Backspace on a fully empty question removes it. Guarded on options too:
      // a choice question with authored options must never vanish on a keystroke.
      if (
        e.key === "Backspace" &&
        e.currentTarget.value === "" &&
        (q?.prompt_te ?? "") === "" &&
        !q?.options.some((o) => o.label_en.trim() !== "")
      ) {
        e.preventDefault();
        remove(id);
      }
    },
    [addQuestion, remove, id, q?.kind, q?.section_id, q?.prompt_te, q?.options],
  );

  if (!q) return null;

  const hasOptions = KIND_HAS_OPTIONS.has(q.kind);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group relative rounded-surface border bg-card",
        isDragging ? "z-10 border-primary/40 opacity-90" : "border-border/70",
      )}
    >
      <div className="flex items-start gap-2 p-3 sm:p-4">
        {/* Drag handle — fades in on hover so the resting state stays clean.
            Hidden while filtering, when reordering is disabled. */}
        {filtering ? (
          <span className="mt-1 h-7 w-6 shrink-0" aria-hidden />
        ) : (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 h-7 w-6 shrink-0 grid place-items-center rounded-control text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 cursor-grab active:cursor-grabbing touch-none"
            aria-label={`Reorder question ${index + 1}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        <span className="mt-2 w-6 shrink-0 t-caption font-mono text-muted-foreground/70 tabular-nums">{index + 1}</span>

        <div className="min-w-0 flex-1 space-y-2">
          <AutoTextarea
            ref={promptRef}
            value={q.prompt_en}
            onChange={(e) => patchQuestion(id, { prompt_en: e.target.value })}
            onKeyDown={onPromptKeyDown}
            placeholder="Type a question…"
            className="t-card font-semibold text-foreground"
            aria-label={`Question ${index + 1}, English`}
          />
          <AutoTextarea
            value={q.prompt_te ?? ""}
            onChange={(e) => patchQuestion(id, { prompt_te: e.target.value })}
            placeholder="తెలుగు అనువాదం (ఐచ్ఛికం)"
            className="t-body text-muted-foreground"
            aria-label={`Question ${index + 1}, Telugu`}
          />

          {hasOptions && (
            <div className="space-y-1 pt-1">
              {q.options.map((o, i) => (
                <div key={o.id} className="flex items-center gap-1.5">
                  <QuestionTypeIcon kind={q.kind} className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <input
                    value={o.label_en}
                    onChange={(e) => patchOption(id, o.id, { label_en: e.target.value })}
                    placeholder={`Option ${i + 1}`}
                    className="min-w-0 flex-1 bg-transparent t-body outline-none placeholder:text-muted-foreground/50 focus:underline focus:decoration-border focus:underline-offset-4"
                    aria-label={`Option ${i + 1}, English`}
                  />
                  <input
                    value={o.label_te ?? ""}
                    onChange={(e) => patchOption(id, o.id, { label_te: e.target.value })}
                    placeholder="తెలుగు"
                    className="min-w-0 flex-1 bg-transparent t-body text-muted-foreground outline-none placeholder:text-muted-foreground/40 focus:underline focus:decoration-border focus:underline-offset-4"
                    aria-label={`Option ${i + 1}, Telugu`}
                  />
                  <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => moveOption(id, o.id, -1)}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-foreground disabled:opacity-20"
                      aria-label="Move option up"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={i === q.options.length - 1}
                      onClick={() => moveOption(id, o.id, 1)}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-foreground disabled:opacity-20"
                      aria-label="Move option down"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      disabled={q.options.length <= 2}
                      onClick={() => removeOption(id, o.id)}
                      className="grid h-6 w-6 place-items-center rounded text-muted-foreground/60 hover:text-destructive disabled:opacity-20"
                      aria-label="Delete option"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => addOptionTo(id)}
                className="ml-5 inline-flex items-center gap-1 t-caption text-muted-foreground hover:text-primary"
              >
                <Plus className="h-3 w-3" /> Add option
              </button>
            </div>
          )}
        </div>

        {/* Row controls */}
        <div className="flex shrink-0 items-center gap-1">
          <Select value={q.kind} onValueChange={(v) => setKind(id, v as QuestionKind)}>
            <SelectTrigger
              className="h-7 w-auto gap-1.5 border-transparent bg-transparent px-2 t-caption text-muted-foreground hover:bg-muted [&>svg]:h-3 [&>svg]:opacity-40"
              aria-label="Question type"
            >
              <QuestionTypeIcon kind={q.kind} className="h-3.5 w-3.5 text-primary" />
              <span className="hidden sm:inline"><SelectValue /></span>
            </SelectTrigger>
            <SelectContent align="end">
              {QUESTION_KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  <span className="flex items-center gap-2">
                    <QuestionTypeIcon kind={k.value} className="h-3.5 w-3.5" />
                    {k.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <OriginBadge origin={q.origin} />
            <label className="flex cursor-pointer items-center gap-1.5 t-caption text-muted-foreground">
              <span className="hidden lg:inline">Required</span>
              <Switch
                checked={q.required}
                onCheckedChange={(v) => patchQuestion(id, { required: v })}
                aria-label="Required"
              />
            </label>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => duplicate(id)}
              aria-label="Duplicate question"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => remove(id)}
              aria-label="Delete question"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});
