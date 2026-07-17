import { useState } from "react";
import { Loader2, Library, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { INSTRUMENTS, importInstruments } from "@/lib/instruments";
import type { SurveyQuestion } from "@/lib/surveys";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function QuestionLibraryDialog({
  open,
  onOpenChange,
  surveyId,
  onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  surveyId: string;
  onImported: (created: SurveyQuestion[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const totalItems = INSTRUMENTS.filter((i) => selected.has(i.key)).reduce((n, i) => n + i.items.length, 0);

  function toggle(key: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(INSTRUMENTS.map((i) => i.key)));
  }

  async function handleImport() {
    if (!selected.size) return;
    setImporting(true);
    try {
      const created = await importInstruments(surveyId, [...selected]);
      onImported(created);
      toast.success(`Imported ${created.length} questions from ${selected.size} instrument${selected.size > 1 ? "s" : ""}`);
      onOpenChange(false);
      setSelected(new Set());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-6">
          <DialogTitle className="t-section flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" strokeWidth={1.5} /> Question library
          </DialogTitle>
          <DialogDescription>
            Validated instruments from the source PDFs. Each imports with its exact response scale — pick any to add to this survey.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4">
          {INSTRUMENTS.map((inst) => {
            const active = selected.has(inst.key);
            return (
              <button
                key={inst.key}
                type="button"
                onClick={() => toggle(inst.key)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-field border p-4 text-left transition-colors duration-base ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]",
                  active ? "border-primary bg-primary-tint" : "border-border hover:bg-sunken",
                )}
              >
                <span
                  className={cn(
                    "mt-1 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[6px] border transition-colors duration-fast ease-out",
                    active ? "border-primary bg-primary" : "border-border-strong bg-sunken",
                  )}
                >
                  {active && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="t-card">{inst.name}</span>
                    <span className="t-caption shrink-0 tabular-nums text-muted-foreground">{inst.items.length} items</span>
                  </span>
                  <span className="t-caption mt-1 block text-muted-foreground">{inst.blurb}</span>
                  <span className="t-caption mt-1 block text-tertiary">{inst.source}</span>
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="flex-row items-center gap-2 border-t border-border p-4 sm:justify-between">
          <Button variant="ghost" size="sm" onClick={selectAll}>
            Select all
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <span className="t-caption tabular-nums text-muted-foreground">{totalItems} questions</span>
            <Button onClick={handleImport} disabled={!selected.size || importing}>
              {importing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Library className="mr-1.5 h-4 w-4" />}
              Import
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
