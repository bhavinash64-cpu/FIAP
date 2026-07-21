import { motion } from "framer-motion";
import { GripVertical, Copy, Trash2, Plus, ChevronUp, ChevronDown, RotateCcw, ShieldAlert, Pencil, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { BANK_KINDS, kindHasOptions, kindMeta, isItemModified, itemIssues, type BankItem, type BankOption } from "@/lib/questionBank";
import type { QuestionKind } from "@/lib/surveys";
import { cn } from "@/lib/utils";

/**
 * One question in the bank. Collapsed it is a readable row; expanded it is the
 * full editor. Bank questions are mostly *read* (browsing for something to add
 * to a survey) and only occasionally edited, so editing is behind a tap rather
 * than every row rendering a wall of inputs — which at 128 items would also be
 * 128 mounted textareas.
 */
export function BankItemCard({
  item,
  index,
  expanded,
  onToggleExpand,
  onChangeField,
  onChangeKind,
  onDelete,
  onDuplicate,
  onRevert,
  onAddOption,
  onUpdateOption,
  onDeleteOption,
  onMoveOption,
  dragHandleProps,
  dragging,
}: {
  item: BankItem;
  index: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onChangeField: (patch: Partial<Pick<BankItem, "prompt_en" | "prompt_te" | "required">>) => void;
  onChangeKind: (kind: QuestionKind) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onRevert: () => void;
  onAddOption: () => void;
  onUpdateOption: (id: string, patch: { label_en?: string; label_te?: string | null }) => void;
  onDeleteOption: (id: string) => void;
  onMoveOption: (id: string, dir: -1 | 1) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  dragging?: boolean;
}) {
  const modified = isItemModified(item);
  const meta = kindMeta(item.kind);
  const issues = itemIssues(item);
  const promptIssue = issues.find((i) => i.field === "prompt_en");
  const optionIssues = issues.filter((i) => i.field === "options");
  // Which option indexes are blank — drives the red ring on that exact input.
  const badOptionIndexes = new Set(optionIssues.map((i) => i.optionIndex).filter((i): i is number => i != null));
  const optionListIssue = optionIssues.find((i) => i.optionIndex == null);
  // Count PROBLEMS, not issue rows: two blank labels also trip the list-level
  // "needs two labels" rule, and billing that as "3 problems" overstates it.
  const problemCount = (promptIssue ? 1 : 0) + (optionIssues.length ? 1 : 0);

  return (
    <div
      className={cn(
        "rounded-surface border bg-card transition-shadow",
        dragging ? "border-primary/40 shadow-lg" : "border-border/70",
        // Incomplete outranks modified: a question that cannot be answered is a
        // harder problem than one that drifted from its source.
        modified && "border-warning/40",
        issues.length > 0 && "border-destructive/50",
      )}
    >
      {/* ── Row ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 p-3 sm:gap-2.5 sm:p-4">
        <button
          type="button"
          {...dragHandleProps}
          className="mt-0.5 grid h-11 w-8 shrink-0 cursor-grab touch-none place-items-center rounded-control text-tertiary hover:bg-muted hover:text-foreground active:cursor-grabbing lg:h-8"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="mt-2.5 w-5 shrink-0 text-right t-caption tabular-nums text-tertiary lg:mt-1.5">{index + 1}</span>

        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="min-w-0 flex-1 rounded-control px-1 py-1.5 text-left transition-colors hover:bg-muted/40"
        >
          <div className={cn("t-body font-medium", !item.prompt_en.trim() && "text-destructive")}>
            {item.prompt_en.trim() || "Question text is required"}
          </div>
          {item.prompt_te && <div className="mt-0.5 truncate t-caption text-muted-foreground">{item.prompt_te}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="gap-1">
              <QuestionTypeIcon kind={item.kind} className="h-3 w-3" />
              {meta.label}
            </Badge>
            {kindHasOptions(item.kind) && (
              <span className={cn("t-caption", optionIssues.length ? "text-destructive" : "text-tertiary")}>
                {item.options.length} options
              </span>
            )}
            {!item.required && <span className="t-caption text-tertiary">Optional</span>}
            {/* Collapsed rows are how you scan 128 questions, so a problem has
                to be visible here — not only once the editor is open. */}
            {issues.length > 0 && (
              <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive">
                <AlertCircle className="h-3 w-3" />
                {problemCount === 1 ? "Needs attention" : `${problemCount} problems`}
              </Badge>
            )}
            {modified && (
              <Badge variant="outline" className="gap-1 border-warning/40 text-warning">
                <ShieldAlert className="h-3 w-3" />
                Modified from source
              </Badge>
            )}
          </div>
        </button>

        <div className="flex shrink-0 items-center">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onToggleExpand}
            aria-label={expanded ? "Done editing" : "Edit question"}
            className="h-11 w-11 text-muted-foreground lg:h-9 lg:w-9"
          >
            {expanded ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* ── Editor ──────────────────────────────────────────────────────── */}
      {expanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="overflow-hidden border-t border-border/70"
        >
          <div className="space-y-4 p-3 sm:p-4">
            {modified && (
              <div className="flex flex-col gap-3 rounded-field border border-warning/30 bg-warning/5 p-3 sm:flex-row sm:items-center">
                <ShieldAlert className="h-4 w-4 shrink-0 text-warning" />
                <p className="min-w-0 flex-1 t-caption leading-relaxed">
                  This differs from the published instrument. Scores from a changed item are no longer comparable to
                  the original's norms.
                </p>
                <Button size="sm" variant="outline" onClick={onRevert} className="shrink-0">
                  <RotateCcw className="h-3.5 w-3.5" /> Revert
                </Button>
              </div>
            )}

            {/* Response type — the "scale / text / radio / checkbox" choice */}
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <div className="space-y-2">
                <label className="t-caption font-medium text-foreground/80">Response type</label>
                <Select value={item.kind} onValueChange={(v) => onChangeKind(v as QuestionKind)}>
                  <SelectTrigger>
                    <span className="flex min-w-0 items-center gap-2">
                      <QuestionTypeIcon kind={item.kind} className="h-4 w-4 shrink-0 text-primary" />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {BANK_KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>
                        <span className="flex items-center gap-2">
                          <QuestionTypeIcon kind={k.value} className="h-3.5 w-3.5" />
                          {k.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <label className="flex h-12 items-center gap-3 rounded-field border border-border px-4 t-caption sm:w-auto">
                Required
                <Switch checked={item.required} onCheckedChange={(v) => onChangeField({ required: v })} />
              </label>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor={`prompt-${item.id}`} className={cn("t-caption font-medium", promptIssue ? "text-destructive" : "text-foreground/80")}>
                  Question (English) <span aria-hidden className="text-destructive">*</span>
                </label>
                <Textarea
                  id={`prompt-${item.id}`}
                  value={item.prompt_en}
                  onChange={(e) => onChangeField({ prompt_en: e.target.value })}
                  placeholder="Question (English)"
                  rows={2}
                  aria-invalid={!!promptIssue}
                  aria-describedby={promptIssue ? `prompt-err-${item.id}` : undefined}
                  className={cn(
                    "min-h-[72px]",
                    promptIssue && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
                  )}
                />
                {promptIssue && (
                  <p id={`prompt-err-${item.id}`} className="flex items-center gap-1.5 t-caption font-medium text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {promptIssue.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="t-caption font-medium text-foreground/80">ప్రశ్న (తెలుగు)</label>
                <Textarea
                  value={item.prompt_te ?? ""}
                  onChange={(e) => onChangeField({ prompt_te: e.target.value })}
                  placeholder="ప్రశ్న (తెలుగు)"
                  rows={2}
                  className="telugu-input min-h-[72px]"
                />
              </div>
            </div>

            {kindHasOptions(item.kind) ? (
              <OptionsList
                itemId={item.id}
                options={item.options}
                badIndexes={badOptionIndexes}
                listError={optionListIssue?.message}
                onAdd={onAddOption}
                onUpdate={onUpdateOption}
                onDelete={onDeleteOption}
                onMove={onMoveOption}
              />
            ) : (
              <p className="rounded-field bg-sunken px-3 py-2.5 t-caption text-muted-foreground">
                {meta.group === "text"
                  ? "Respondents type their own answer — no options needed."
                  : "This type renders its own fixed scale — no options needed."}
                {item.options.length > 0 && ` Your ${item.options.length} saved options are kept and will reappear if you switch back.`}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 pt-3">
              <Button size="sm" variant="outline" onClick={onDuplicate}>
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={onDelete}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

function OptionsList({
  itemId,
  options,
  badIndexes,
  listError,
  onAdd,
  onUpdate,
  onDelete,
  onMove,
}: {
  itemId: string;
  options: BankOption[];
  badIndexes: Set<number>;
  listError?: string;
  onAdd: () => void;
  onUpdate: (id: string, patch: { label_en?: string; label_te?: string | null }) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}) {
  return (
    <div className="space-y-2">
      <label className={cn("t-caption font-medium", listError ? "text-destructive" : "text-foreground/80")}>
        Options <span aria-hidden className="text-destructive">*</span>
      </label>
      {listError && (
        <p id={`opt-list-err-${itemId}`} className="flex items-center gap-1.5 t-caption font-medium text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {listError}
        </p>
      )}
      {options.map((o, i) => (
        <div
          key={o.id}
          className={cn(
            "flex items-start gap-2 rounded-field border bg-sunken/40 p-2",
            badIndexes.has(i) ? "border-destructive/50 bg-destructive/[0.03]" : "border-border/70",
          )}
        >
          {/* Stacked 24px arrows would be a 24px target; 44px each keeps the
              pair tappable without turning the row into a toolbar. */}
          <div className="flex shrink-0 flex-col">
            <button
              type="button"
              disabled={i === 0}
              onClick={() => onMove(o.id, -1)}
              aria-label="Move option up"
              className="grid h-6 w-8 place-items-center rounded-control text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25 lg:h-4"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={i === options.length - 1}
              onClick={() => onMove(o.id, 1)}
              aria-label="Move option down"
              className="grid h-6 w-8 place-items-center rounded-control text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-25 lg:h-4"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Stacks at 320px; the old side-by-side pair left ~90px per field. */}
          <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
            <div className="min-w-0 space-y-1.5">
              <Input
                value={o.label_en}
                onChange={(e) => onUpdate(o.id, { label_en: e.target.value })}
                placeholder={`Option ${i + 1} (English)`}
                aria-invalid={badIndexes.has(i)}
                aria-label={`Option ${i + 1} label in English`}
                aria-describedby={badIndexes.has(i) ? `opt-err-${o.id}` : undefined}
                className={cn(
                  "h-11 lg:h-9",
                  badIndexes.has(i) && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/30",
                )}
              />
              {/* The ring alone told a sighted user something was wrong but not
                  what, and told a screen-reader user only "invalid". */}
              {badIndexes.has(i) && (
                <p id={`opt-err-${o.id}`} className="t-caption font-medium text-destructive">
                  This option needs a label.
                </p>
              )}
            </div>
            <Input
              value={o.label_te ?? ""}
              onChange={(e) => onUpdate(o.id, { label_te: e.target.value })}
              placeholder="తెలుగు"
              className="telugu-input h-11 lg:h-9"
            />
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => onDelete(o.id)}
            disabled={options.length <= 2}
            aria-label="Delete option"
            className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive lg:h-9 lg:w-9"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={onAdd}>
        <Plus className="h-3.5 w-3.5" /> Add option
      </Button>
    </div>
  );
}
