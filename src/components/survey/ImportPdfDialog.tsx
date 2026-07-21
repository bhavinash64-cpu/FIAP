import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UploadCloud, FileText, Loader2, AlertCircle, Sparkles, Trash2, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { extractPdfText } from "@/lib/pdfExtract";
import { extractQuestionsFromText, ExtractionError, flagIntraBatchDuplicates, toDraftsWithDuplicateCheck } from "@/lib/aiQuestions";
import { importQuestions, QUESTION_KINDS, type QuestionDraft, type QuestionKind, type SurveyQuestion } from "@/lib/surveys";
import { toast } from "sonner";

type Stage = "idle" | "reading" | "extracting" | "review" | "error";

export function ImportPdfDialog({
  open,
  onOpenChange,
  surveyId,
  existingQuestions,
  onImported,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  surveyId: string;
  existingQuestions: SurveyQuestion[];
  onImported: (created: SurveyQuestion[]) => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);
  const [pageProgress, setPageProgress] = useState({ page: 0, total: 0 });
  const [truncatedNote, setTruncatedNote] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [drafts, setDrafts] = useState<QuestionDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStage("idle"); setFileName(""); setFileSize(0); setPageProgress({ page: 0, total: 0 });
    setTruncatedNote(null); setErrorMsg(""); setDrafts([]); setSaving(false);
  }

  function close(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleFile(file: File) {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setStage("error"); setErrorMsg("Please choose a PDF file.");
      return;
    }
    setFileName(file.name);
    setFileSize(file.size);
    setStage("reading");
    try {
      const { text, pageCount, charsExtracted } = await extractPdfText(file, (page, total) => setPageProgress({ page, total }));
      if (pageCount > 60) setTruncatedNote(`This PDF has ${pageCount} pages — only the first 60 were processed.`);

      if (charsExtracted < 20) {
        setStage("error");
        setErrorMsg("This PDF doesn't seem to contain selectable text — it may be a scanned image. Try a text-based PDF, or run it through OCR first.");
        return;
      }

      setStage("extracting");
      const raw = await extractQuestionsFromText(text);
      if (raw.length === 0) {
        setStage("error");
        setErrorMsg("No questions could be found in this PDF. Double-check it contains a questionnaire, then try again.");
        return;
      }
      const withDupes = flagIntraBatchDuplicates(toDraftsWithDuplicateCheck(raw, existingQuestions));
      setDrafts(withDupes);
      setStage("review");
    } catch (e) {
      setStage("error");
      setErrorMsg(e instanceof ExtractionError ? e.message : "Something went wrong while reading this PDF. Please try again.");
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function updateDraft(id: string, patch: Partial<QuestionDraft>) {
    setDrafts((ds) => ds.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }

  async function handleAddToSurvey() {
    // Trim and drop blank option lines at persist time (not while editing, so a
    // newly-typed newline doesn't vanish) — an empty option becomes an empty,
    // unlabelled answer button in the published survey.
    const included = drafts
      .filter((d) => d.include)
      .map((d) => ({ ...d, options: d.options.map((o) => o.trim()).filter(Boolean) }));
    if (!included.length) return toast.error("Select at least one question to add.");
    setSaving(true);
    try {
      const created = await importQuestions(surveyId, included, "pdf", fileName);
      toast.success(`${created.length} question${created.length === 1 ? "" : "s"} added from ${fileName}`);
      onImported(created);
      close(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add these questions.");
    } finally {
      setSaving(false);
    }
  }

  const includedCount = drafts.filter((d) => d.include).length;

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-2xl sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><FileText className="h-4.5 w-4.5 text-primary" />Import questions from PDF</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-1 px-1">
          {stage === "idle" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-primary bg-accent/50" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
            >
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              <UploadCloud className="h-9 w-9 mx-auto text-muted-foreground" />
              <div className="mt-3 font-medium">Drag and drop a PDF here</div>
              <div className="mt-1 text-sm text-muted-foreground">or tap to choose a file</div>
              <div className="mt-4 text-xs text-muted-foreground">English and Telugu questionnaires are both supported.</div>
            </div>
          )}

          {(stage === "reading" || stage === "extracting") && (
            <div className="py-14 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-accent grid place-items-center">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
              <div className="mt-4 text-sm font-medium truncate max-w-xs mx-auto">{fileName} <span className="text-muted-foreground font-normal">({formatSize(fileSize)})</span></div>
              <div className="mt-1.5 text-sm text-muted-foreground">
                {stage === "reading"
                  ? pageProgress.total ? `Reading page ${pageProgress.page} of ${pageProgress.total}…` : "Reading PDF…"
                  : "Asking AI to identify the questions…"}
              </div>
              {stage === "reading" && pageProgress.total > 0 && (
                <div className="mt-4 mx-auto max-w-xs h-1.5 rounded-pill bg-muted overflow-hidden">
                  <motion.div initial={false} animate={{ width: `${(pageProgress.page / pageProgress.total) * 100}%` }} className="h-full brand-gradient" />
                </div>
              )}
            </div>
          )}

          {stage === "error" && (
            <div className="py-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-destructive/10 grid place-items-center">
                <AlertCircle className="h-5 w-5 text-destructive" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{errorMsg}</p>
              <Button variant="outline" className="mt-5 rounded-xl" onClick={reset}>Try another file</Button>
            </div>
          )}

          {stage === "review" && (
            <div className="space-y-3 py-2">
              {truncatedNote && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {truncatedNote}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" /> Found {drafts.length} question{drafts.length === 1 ? "" : "s"}. Review before adding — nothing is saved yet.
              </div>

              <AnimatePresence initial={false}>
                {drafts.map((d) => {
                  const kindMeta = QUESTION_KINDS.find((k) => k.value === d.kind)!;
                  return (
                    <motion.div key={d.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }}
                      className={`rounded-xl border p-3.5 ${d.include ? "border-border/70" : "border-border/40 opacity-50"}`}>
                      <div className="flex items-start gap-3">
                        <Checkbox checked={d.include} onCheckedChange={(v) => updateDraft(d.id, { include: !!v })} className="mt-1" />
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Select value={d.kind} onValueChange={(v) => updateDraft(d.id, { kind: v as QuestionKind })}>
                              <SelectTrigger className="h-7 w-auto rounded-field t-caption px-2 gap-1"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {QUESTION_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                            {d.duplicateOfPrompt && (
                              <Badge variant="outline" className="t-caption border-warning/40 text-warning">
                                Possible duplicate of "{truncate(d.duplicateOfPrompt, 40)}"
                              </Badge>
                            )}
                            <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto text-muted-foreground hover:text-destructive" onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== d.id))}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                          <Textarea value={d.prompt_en} onChange={(e) => updateDraft(d.id, { prompt_en: e.target.value })} rows={2} className="rounded-lg text-sm" />
                          {kindMeta.hasOptions && (
                            <Textarea
                              value={d.options.join("\n")}
                              onChange={(e) => updateDraft(d.id, { options: e.target.value.split("\n") })}
                              rows={Math.min(5, Math.max(2, d.options.length))}
                              placeholder="One option per line"
                              className="rounded-lg text-xs font-mono"
                            />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {stage === "review" && (
          <DialogFooter className="pt-2 border-t border-border/60 -mx-6 px-6 mt-2">
            <Button variant="outline" onClick={() => close(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleAddToSurvey} disabled={saving || includedCount === 0} className="rounded-xl">
              {saving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
              Add {includedCount} question{includedCount === 1 ? "" : "s"} to survey
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}
