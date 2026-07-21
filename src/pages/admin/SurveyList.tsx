import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { Plus, FileQuestion, Users, CalendarDays, Trash2, BarChart3, ArrowUpRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { EmptyState, EmptySurveyArt } from "@/components/admin/EmptyState";
import { createSurvey, deleteSurvey, listSurveys } from "@/lib/surveys";
import { useLangMode } from "@/lib/i18n";
import { staggerParent, staggerChild, easeOut } from "@/lib/motion";
import { toast } from "sonner";

export default function SurveyList() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const mode = useLangMode();
  const te = mode === "te";
  const reduceMotion = useReducedMotion();
  // Shared ["surveys"] cache — one source of truth with the dashboard, reports
  // and QR pages, so a create/delete here shows everywhere without a divergent
  // second fetch.
  const { data: surveys, isPending } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      // Refresh the shared cache the dashboard / analytics / QR pages read.
      qc.invalidateQueries({ queryKey: ["surveys"] });
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
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Survey deleted");
      setDeleteId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete survey");
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Studio"
        title="Surveys"
        subtitle="Create, publish and track every assessment. Share a link — respondents answer with no login."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" strokeWidth={1.5} /> New survey
          </Button>
        }
      />

      {isPending ? (
        <div className="mt-6 flex flex-col gap-2.5">
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-[4.5rem] animate-pulse rounded-surface bg-muted/50" />)}
        </div>
      ) : !surveys?.length ? (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: easeOut }}
          className="mt-6 rounded-surface border border-border bg-card shadow-[var(--highlight-top),var(--shadow-sm)]"
        >
          <EmptyState
            illustration={<EmptySurveyArt />}
            title="No surveys yet"
            description="Create your first survey to start collecting responses from the public — or start from a standardised instrument in the Question Library."
            primaryAction={
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" strokeWidth={1.5} /> New survey
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link to="/app/question-bank">Browse Question Library</Link>
              </Button>
            }
          />
        </motion.div>
      ) : (
        <motion.div variants={staggerParent} initial="hidden" animate="show" className="mt-6 flex flex-col gap-2.5">
          {surveys.map((s) => (
            <motion.div key={s.id} variants={staggerChild}>
              {/* Denser single-row card: status + title on one line, meta beneath,
                  consistent trailing actions. Roughly half the previous height. */}
              <div className="group flex items-center gap-4 rounded-surface border border-border/70 bg-card px-4 py-3.5 transition-colors duration-fast ease-out hover:border-border-strong hover:bg-sunken sm:px-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <StatusBadge status={s.status} />
                    <Link to={`/app/surveys/${s.id}/edit`} className="min-w-0 truncate t-card transition-colors hover:text-primary">
                      {s.title_en}
                    </Link>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 t-caption text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" strokeWidth={1.6} />{s.question_count} questions</span>
                    <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" strokeWidth={1.6} />{s.response_count} responses</span>
                    <span className="hidden items-center gap-1 sm:inline-flex"><CalendarDays className="h-3.5 w-3.5" strokeWidth={1.6} />{new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild size="sm" variant="secondary" className="hidden sm:inline-flex">
                    <Link to={`/app/surveys/${s.id}/edit`}>Open <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} /></Link>
                  </Button>
                  <Button asChild size="icon" variant="ghost" aria-label="Open" className="h-9 w-9 sm:hidden">
                    <Link to={`/app/surveys/${s.id}/edit`}><ArrowUpRight className="h-4 w-4" strokeWidth={1.6} /></Link>
                  </Button>
                  <Button asChild size="icon" variant="ghost" aria-label="Analytics" className="h-9 w-9">
                    <Link to={`/app/surveys/${s.id}/analytics`}><BarChart3 className="h-4 w-4" strokeWidth={1.6} /></Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteId(s.id)}
                    aria-label="Delete survey"
                    className="h-9 w-9 text-tertiary transition-colors hover:bg-danger/10 hover:text-danger focus-visible:text-tertiary active:scale-90 sm:text-transparent sm:group-hover:text-tertiary"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.6} />
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
                onKeyDown={(e) => { if (e.key === "Enter" && !saving) handleCreate(); }}
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
    </PageContainer>
  );
}
