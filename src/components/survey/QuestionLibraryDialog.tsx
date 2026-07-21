import { useEffect, useState } from "react";
import { Loader2, Library, Check, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { listBank, importInstrumentsToSurvey, isInstrumentModified, type BankInstrument } from "@/lib/questionBank";
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
  // Read live rather than from the static constant, so an instrument the user
  // edited in the Question Bank imports as they edited it.
  const [bank, setBank] = useState<BankInstrument[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Fresh selection every time it opens — Cancel/Esc/overlay-close must never
    // leave a stale, pre-checked selection to reappear on reopen.
    setSelected(new Set());
    setBank(null);
    listBank()
      .then(setBank)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : "Could not load the question bank.");
        setBank([]);
      });
  }, [open]);

  const instruments = bank ?? [];
  const totalItems = instruments.filter((i) => selected.has(i.id)).reduce((n, i) => n + i.items.length, 0);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (!selected.size) return;
    setImporting(true);
    try {
      const created = await importInstrumentsToSurvey(surveyId, [...selected]);
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
      <DialogContent className="max-h-[92dvh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border p-4 sm:p-6">
          <DialogTitle className="t-section flex items-center gap-2">
            <Library className="h-5 w-5 text-primary" strokeWidth={1.5} /> Question library
          </DialogTitle>
          <DialogDescription>
            Instruments from your Question Bank. Each imports with its exact response scale — pick any to add to this survey.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[52vh] space-y-2 overflow-y-auto p-3 sm:p-4">
          {bank === null ? (
            <div className="grid place-items-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : instruments.length === 0 ? (
            <p className="px-2 py-12 text-center t-body text-muted-foreground">
              Your question bank is empty. Add instruments from the Question Bank first.
            </p>
          ) : (
            instruments.map((inst) => {
              const active = selected.has(inst.id);
              const modified = isInstrumentModified(inst);
              return (
                <button
                  key={inst.id}
                  type="button"
                  onClick={() => toggle(inst.id)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-field border p-3.5 text-left transition-colors duration-base ease-out focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] sm:p-4",
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
                      <span className="t-card">{inst.name_en}</span>
                      <span className="t-caption shrink-0 tabular-nums text-muted-foreground">{inst.items.length} items</span>
                    </span>
                    {inst.blurb_en && <span className="t-caption mt-1 block text-muted-foreground">{inst.blurb_en}</span>}
                    {inst.source && <span className="t-caption mt-1 block text-tertiary">{inst.source}</span>}
                    {modified && (
                      <span className="mt-1.5 inline-flex items-center gap-1 t-caption text-warning">
                        <ShieldAlert className="h-3 w-3" /> Edited — no longer the published version
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="flex-row items-center gap-2 border-t border-border p-3 sm:justify-between sm:p-4">
          <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(instruments.map((i) => i.id)))} disabled={!instruments.length}>
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
