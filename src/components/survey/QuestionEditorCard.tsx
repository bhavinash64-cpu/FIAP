import { GripVertical, Copy, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { OptionsEditor } from "@/components/survey/OptionsEditor";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { OriginBadge } from "@/components/survey/OriginBadge";
import { QUESTION_KINDS, type QuestionKind, type SurveyQuestion } from "@/lib/surveys";

export function QuestionEditorCard({
  question,
  index,
  onChangeField,
  onChangeKind,
  onDelete,
  onDuplicate,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onMoveOption,
  dragHandleProps,
  dragging,
}: {
  question: SurveyQuestion;
  index: number;
  onChangeField: (patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required">>) => void;
  onChangeKind: (kind: QuestionKind) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddOption: () => void;
  onUpdateOption: (id: string, patch: { label_en?: string; label_te?: string }) => void;
  onDeleteOption: (id: string) => void;
  onMoveOption: (id: string, dir: -1 | 1) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
}) {
  const kindMeta = QUESTION_KINDS.find((k) => k.value === question.kind)!;

  return (
    <div className={`rounded-2xl border bg-card p-4 sm:p-5 transition-shadow ${dragging ? "shadow-lg border-primary/40" : "border-border/70"}`}>
      <div className="flex items-start gap-2.5">
        <button type="button" {...dragHandleProps} className="mt-1 h-8 w-8 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none" aria-label="Drag to reorder">
          <GripVertical className="h-4 w-4" />
        </button>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground w-6">{index + 1}.</span>
            <Select value={question.kind} onValueChange={(v) => onChangeKind(v as QuestionKind)}>
              <SelectTrigger className="h-8 w-auto gap-1.5 rounded-lg text-xs px-2.5 [&>svg]:hidden">
                <QuestionTypeIcon kind={question.kind} className="h-3.5 w-3.5 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_KINDS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    <span className="flex items-center gap-2"><QuestionTypeIcon kind={k.value} className="h-3.5 w-3.5" />{k.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="text-[10px]">{kindMeta.label}</Badge>
            <OriginBadge origin={question.origin} />
            <div className="ml-auto flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Required
                <Switch checked={question.required} onCheckedChange={(v) => onChangeField({ required: v })} />
              </label>
              <Button type="button" size="icon" variant="ghost" onClick={onDuplicate} className="h-8 w-8" aria-label="Duplicate question">
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={onDelete} className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label="Delete question">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <Textarea
              value={question.prompt_en}
              onChange={(e) => onChangeField({ prompt_en: e.target.value })}
              placeholder="Question (English)"
              rows={2}
              className="rounded-xl text-sm"
            />
            <Textarea
              value={question.prompt_te ?? ""}
              onChange={(e) => onChangeField({ prompt_te: e.target.value })}
              placeholder="ప్రశ్న (తెలుగు)"
              rows={2}
              className="rounded-xl text-sm"
            />
          </div>

          {kindMeta.hasOptions && (
            <OptionsEditor
              options={question.options}
              onAdd={onAddOption}
              onUpdate={onUpdateOption}
              onDelete={onDeleteOption}
              onMove={onMoveOption}
            />
          )}
        </div>
      </div>
    </div>
  );
}
