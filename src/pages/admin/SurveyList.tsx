import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Plus, FileQuestion, Users, CalendarDays, Trash2, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { EmptyState } from "@/components/survey/EmptyState";
import { SurveyCardSkeleton } from "@/components/survey/Skeletons";
import { createSurvey, deleteSurvey, listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { toast } from "sonner";

export default function SurveyList() {
  const nav = useNavigate();
  const [surveys, setSurveys] = useState<SurveyWithCounts[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title_en: "", title_te: "", description_en: "", description_te: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setSurveys(await listSurveys());
  }

  async function handleCreate() {
    if (!form.title_en.trim()) return toast.error("Give the survey a title first.");
    setSaving(true);
    try {
      const id = await createSurvey(form);
      toast.success("Survey created");
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
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 md:py-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Surveys</div>
          <h1 className="mt-1 text-3xl md:text-4xl font-semibold tracking-tight">Your surveys</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Create, publish and track responses.</p>
        </div>
        <Button onClick={() => setCreating(true)} className="rounded-xl h-11 shadow-md">
          <Plus className="h-4 w-4 mr-1.5" /> New survey
        </Button>
      </div>

      {surveys === null ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <SurveyCardSkeleton key={i} />)}
        </div>
      ) : surveys.length === 0 ? (
        <div className="mt-8">
          <Card className="rounded-2xl border-border/70 border-dashed">
            <EmptyState
              icon={FileQuestion}
              title="No surveys yet"
              body="Create your first survey to start collecting responses from the public."
              action={<Button onClick={() => setCreating(true)} className="rounded-xl"><Plus className="h-4 w-4 mr-1.5" />New survey</Button>}
            />
          </Card>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {surveys.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Card className="rounded-2xl border-border/70 hover:shadow-md transition-shadow h-full flex flex-col">
                <CardContent className="p-5 flex flex-col h-full">
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={s.status} />
                    <Button size="icon" variant="ghost" className="h-7 w-7 -mt-1 -mr-1 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(s.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Link to={`/app/surveys/${s.id}/edit`} className="mt-3 font-semibold leading-snug hover:text-primary transition-colors line-clamp-2">
                    {s.title_en}
                  </Link>
                  {s.description_en && <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{s.description_en}</p>}
                  <div className="mt-auto pt-4 flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" />{s.question_count} questions</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.response_count} responses</span>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <CalendarDays className="h-3 w-3" /> {new Date(s.created_at).toLocaleDateString()}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button asChild size="sm" variant="outline" className="rounded-lg flex-1">
                      <Link to={`/app/surveys/${s.id}/edit`}>Open</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="rounded-lg" aria-label="Analytics">
                      <Link to={`/app/surveys/${s.id}/analytics`}><BarChart3 className="h-3.5 w-3.5" /></Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>New survey</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Title (English)</Label>
                <Input value={form.title_en} onChange={(e) => setForm({ ...form, title_en: e.target.value })} placeholder="Family well-being survey" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Title (Telugu)</Label>
                <Input value={form.title_te} onChange={(e) => setForm({ ...form, title_te: e.target.value })} placeholder="కుటుంబ శ్రేయస్సు సర్వే" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Description (English)</Label>
                <Textarea value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} rows={3} />
              </div>
              <div className="space-y-1.5">
                <Label>Description (Telugu)</Label>
                <Textarea value={form.description_te} onChange={(e) => setForm({ ...form, description_te: e.target.value })} rows={3} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="rounded-xl">{saving ? "Creating…" : "Create survey"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this survey?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the survey, its questions and every response. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
