import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, FileQuestion, Users, CalendarDays, Trash2, BarChart3, ArrowUpRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { createSurvey, deleteSurvey, listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { useLangMode } from "@/lib/i18n";
import { staggerParent, staggerChild, easeOut } from "@/lib/motion";
import { toast } from "sonner";

export default function SurveyList() {
  const nav = useNavigate();
  const mode = useLangMode();
  const te = mode === "te";
  const reduceMotion = useReducedMotion();
  const [surveys, setSurveys] = useState<SurveyWithCounts[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setSurveys(await listSurveys());
  }

  function openCreate() {
    setForm({ title: "", description: "" });
    setCreating(true);
  }

  async function handleCreate() {
    const title = form.title.trim();
    if (!title) return toast.error(te ? "ముందుగా ఒక శీర్షిక ఇవ్వండి." : "Give the survey a title first.");
    const desc = form.description.trim() || undefined;
    setSaving(true);
    try {
      // One field, active language. title_en is the canonical value the console
      // displays, so it is always set; in Telugu mode we mirror it into title_te
      // as well so the public Telugu view shows the same text. No duplicate fields.
      const id = await createSurvey(
        te
          ? { title_en: title, title_te: title, description_en: desc, description_te: desc }
          : { title_en: title, description_en: desc },
      );
      toast.success(te ? "సర్వే సృష్టించబడింది" : "Survey created");
      nav(`/app/surveys/${id}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create survey");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteSurvey(deleteId);
      toast.success("Survey deleted");
      setDeleteId(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete survey");
    }
  }

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow text-primary">Studio</div>
          <h1 className="t-title mt-2">Surveys</h1>
          <p className="mt-2 max-w-xl t-body text-muted-foreground">Create, publish and track every assessment. Share a link — respondents answer with no login.</p>
        </div>
        <Button onClick={openCreate} className="shrink-0">
          <Plus className="h-4 w-4" strokeWidth={1.5} /> New survey
        </Button>
      </header>

      {surveys === null ? (
        <div className="mt-8 flex flex-col gap-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-32 animate-pulse rounded-surface bg-muted/50" />)}
        </div>
      ) : surveys.length === 0 ? (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOut }}
          className="mt-8 flex flex-col items-center rounded-surface border border-border bg-card px-6 py-24 text-center shadow-[var(--highlight-top),var(--shadow-sm)]"
        >
          <div className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <FileQuestion className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">No surveys yet</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">Create your first survey to start collecting responses from the public.</p>
          <Button onClick={openCreate} className="mt-6">
            <Plus className="h-4 w-4" strokeWidth={1.5} /> New survey
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={staggerParent} initial="hidden" animate="show" className="mt-8 flex flex-col gap-4">
          {surveys.map((s) => (
            <motion.div key={s.id} variants={staggerChild}>
              <div className="group flex flex-col gap-4 rounded-surface border border-border bg-card px-6 py-6 shadow-[var(--highlight-top),var(--shadow-sm)] transition-colors duration-base ease-out hover:bg-sunken sm:flex-row sm:items-center sm:gap-6">
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <StatusBadge status={s.status} />
                  <Link to={`/app/surveys/${s.id}/edit`} className="mt-3 block truncate t-card transition-colors hover:text-primary">
                    {s.title_en}
                  </Link>
                  {s.description_en && <p className="mt-1 line-clamp-1 t-caption text-muted-foreground">{s.description_en}</p>}

                  <div className="mt-3 flex flex-wrap items-center gap-4 t-caption text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" strokeWidth={1.5} />{s.question_count} questions</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" strokeWidth={1.5} />{s.response_count} responses</span>
                    <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/app/surveys/${s.id}/edit`}>Open <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.5} /></Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost" aria-label="Analytics">
                    <Link to={`/app/surveys/${s.id}/analytics`}><BarChart3 className="h-3.5 w-3.5" strokeWidth={1.5} /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(s.id)}
                    aria-label="Delete survey"
                    className="h-9 w-9 text-tertiary opacity-0 hover:bg-danger/10 hover:text-danger focus:opacity-100 group-hover:opacity-100 active:scale-90"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* New survey — single language, follows the active toggle */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="t-section">{te ? "కొత్త సర్వే" : "New survey"}</DialogTitle>
            <DialogDescription className="t-caption">
              {te ? "మీరు తర్వాత బిల్డర్‌లో అనువాదాలు జోడించవచ్చు." : "You can add the other language later in the builder."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label className="t-caption">{te ? "శీర్షిక" : "Title"}</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={te ? "కుటుంబ శ్రేయస్సు సర్వే" : "Family well-being survey"}
                autoFocus
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <div className="space-y-2">
              <Label className="t-caption">{te ? "వివరణ" : "Description"} <span className="font-normal text-tertiary">({te ? "ఐచ్ఛికం" : "optional"})</span></Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder={te ? "ఈ సర్వే దేని గురించి?" : "What is this survey about?"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>{te ? "రద్దు" : "Cancel"}</Button>
            <Button onClick={handleCreate} disabled={saving}>{saving ? (te ? "సృష్టిస్తోంది…" : "Creating…") : (te ? "సర్వే సృష్టించు" : "Create survey")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="t-section">Delete this survey?</AlertDialogTitle>
            <AlertDialogDescription className="t-caption">This permanently removes the survey, its questions and every response. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className={buttonVariants({ variant: "destructive" })}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
