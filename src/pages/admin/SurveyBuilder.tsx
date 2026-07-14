import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Check, Plus, Eye, Rocket, Lock, LockOpen, ChevronDown, FileUp, Mic, EyeOff, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { ShareLinkCard } from "@/components/survey/ShareLinkCard";
import { SortableQuestionList } from "@/components/survey/SortableQuestionList";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { EmptyState } from "@/components/survey/EmptyState";
import { QuestionCardSkeleton } from "@/components/survey/Skeletons";
import { ImportPdfDialog } from "@/components/survey/ImportPdfDialog";
import { VoiceDialog } from "@/components/survey/VoiceDialog";
import { useOriginVisibility } from "@/components/survey/OriginBadge";
import {
  QUESTION_KINDS,
  addOption,
  closeSurvey,
  createQuestion,
  deleteOption,
  deleteQuestion,
  duplicateQuestion,
  getSurveyWithQuestions,
  publishSurvey,
  reopenSurvey,
  reorderOptions,
  reorderQuestions,
  updateOption,
  updateQuestion,
  updateSurveyMeta,
  type QuestionKind,
  type Survey,
  type SurveyQuestion,
} from "@/lib/surveys";
import { toast } from "sonner";
import { FileQuestion } from "lucide-react";

type SaveState = "idle" | "saving" | "saved";

export default function SurveyBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const showOrigin = useOriginVisibility((s) => s.visible);
  const toggleOrigin = useOriginVisibility((s) => s.toggle);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (id) load(id); }, [id]);

  async function load(surveyId: string) {
    const data = await getSurveyWithQuestions(surveyId);
    if (!data) return nav("/app/surveys");
    setSurvey(data.survey);
    setQuestions(data.questions);
  }

  function updateMeta(patch: Partial<Pick<Survey, "title_en" | "title_te" | "description_en" | "description_te">>) {
    if (!survey) return;
    setSurvey({ ...survey, ...patch });
    setSaveState("saving");
    if (metaTimer.current) clearTimeout(metaTimer.current);
    metaTimer.current = setTimeout(async () => {
      await updateSurveyMeta(survey.id, patch);
      setSaveState("saved");
    }, 500);
  }

  function persistQuestion(qid: string, patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required" | "kind">>) {
    setSaveState("saving");
    if (questionTimers.current[qid]) clearTimeout(questionTimers.current[qid]);
    questionTimers.current[qid] = setTimeout(async () => {
      await updateQuestion(qid, patch);
      setSaveState("saved");
    }, 500);
  }

  const handleChangeField = useCallback((qid: string, patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required">>) => {
    setQuestions((qs) => qs?.map((q) => (q.id === qid ? { ...q, ...patch } : q)) ?? qs);
    persistQuestion(qid, patch);
  }, []);

  const handleChangeKind = useCallback(async (qid: string, kind: QuestionKind) => {
    const meta = QUESTION_KINDS.find((k) => k.value === kind)!;
    setQuestions((qs) => qs?.map((q) => (q.id === qid ? { ...q, kind } : q)) ?? qs);
    setSaveState("saving");
    await updateQuestion(qid, { kind });
    if (meta.hasOptions) {
      const q = questions?.find((x) => x.id === qid);
      if (q && q.options.length === 0) {
        const o1 = await addOption(qid, 0);
        const o2 = await addOption(qid, 1);
        setQuestions((qs) => qs?.map((x) => (x.id === qid ? { ...x, options: [o1, o2] } : x)) ?? qs);
      }
    }
    setSaveState("saved");
  }, [questions]);

  async function handleAddQuestion(kind: QuestionKind = "short_text") {
    if (!survey) return;
    const q = await createQuestion(survey.id, kind);
    setQuestions((qs) => [...(qs ?? []), q]);
    toast.success("Question added");
  }

  async function handleDeleteQuestion(qid: string) {
    setQuestions((qs) => qs?.filter((q) => q.id !== qid) ?? qs);
    await deleteQuestion(qid);
  }

  async function handleDuplicateQuestion(qid: string) {
    const q = questions?.find((x) => x.id === qid);
    if (!q) return;
    const copy = await duplicateQuestion(q);
    setQuestions((qs) => [...(qs ?? []), copy]);
  }

  async function handleReorder(orderedIds: string[]) {
    setQuestions((qs) => {
      if (!qs) return qs;
      const map = new Map(qs.map((q) => [q.id, q]));
      return orderedIds.map((id) => map.get(id)!);
    });
    setSaveState("saving");
    await reorderQuestions(orderedIds);
    setSaveState("saved");
  }

  async function handleAddOption(qid: string) {
    const q = questions?.find((x) => x.id === qid);
    const nextIndex = q ? q.options.length : 0;
    const o = await addOption(qid, nextIndex);
    setQuestions((qs) => qs?.map((x) => (x.id === qid ? { ...x, options: [...x.options, o] } : x)) ?? qs);
  }

  async function handleUpdateOption(qid: string, oid: string, patch: { label_en?: string; label_te?: string }) {
    setQuestions((qs) => qs?.map((x) => (x.id === qid ? { ...x, options: x.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) } : x)) ?? qs);
    setSaveState("saving");
    await updateOption(oid, patch);
    setSaveState("saved");
  }

  async function handleDeleteOption(qid: string, oid: string) {
    setQuestions((qs) => qs?.map((x) => (x.id === qid ? { ...x, options: x.options.filter((o) => o.id !== oid) } : x)) ?? qs);
    await deleteOption(oid);
  }

  async function handleMoveOption(qid: string, oid: string, dir: -1 | 1) {
    const q = questions?.find((x) => x.id === qid);
    if (!q) return;
    const idx = q.options.findIndex((o) => o.id === oid);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= q.options.length) return;
    const next = [...q.options];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setQuestions((qs) => qs?.map((x) => (x.id === qid ? { ...x, options: next } : x)) ?? qs);
    await reorderOptions(next.map((o) => o.id));
  }

  async function handlePublish() {
    if (!survey) return;
    if (!questions || questions.length === 0) return toast.error("Add at least one question before publishing.");
    setPublishing(true);
    try {
      const slug = await publishSurvey(survey.id);
      setSurvey({ ...survey, status: "published", slug, published_at: new Date().toISOString() });
      toast.success("Survey published");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  async function handleClose() {
    if (!survey) return;
    await closeSurvey(survey.id);
    setSurvey({ ...survey, status: "closed" });
    toast.success("Survey closed to new responses");
  }

  async function handleReopen() {
    if (!survey) return;
    await reopenSurvey(survey.id);
    setSurvey({ ...survey, status: "published" });
    toast.success("Survey reopened");
  }

  if (!survey || !questions) {
    return (
      <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-3">
        <QuestionCardSkeleton />
        <QuestionCardSkeleton />
      </div>
    );
  }

  return (
    <div className="pb-24">
      <div className="sticky top-16 z-20 border-b border-border/60 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm"><Link to="/app/surveys"><ArrowLeft className="h-4 w-4 mr-1.5" />Surveys</Link></Button>
          <StatusBadge status={survey.status} />
          <div className="text-xs text-muted-foreground w-20">
            {saveState === "saving" && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>}
            {saveState === "saved" && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1 text-success"><Check className="h-3 w-3" />Saved</motion.span>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="rounded-lg"><Link to={`/app/surveys/${survey.id}/analytics`}><BarChart3 className="h-3.5 w-3.5 mr-1.5" />Analytics</Link></Button>
            <Button asChild variant="outline" size="sm" className="rounded-lg"><Link to={`/app/surveys/${survey.id}/preview`}><Eye className="h-3.5 w-3.5 mr-1.5" />Preview</Link></Button>
            {survey.status === "draft" && (
              <Button size="sm" onClick={handlePublish} disabled={publishing} className="rounded-lg">
                {publishing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5 mr-1.5" />}Publish
              </Button>
            )}
            {survey.status === "published" && (
              <Button size="sm" variant="outline" onClick={handleClose} className="rounded-lg"><Lock className="h-3.5 w-3.5 mr-1.5" />Close</Button>
            )}
            {survey.status === "closed" && (
              <Button size="sm" variant="outline" onClick={handleReopen} className="rounded-lg"><LockOpen className="h-3.5 w-3.5 mr-1.5" />Reopen</Button>
            )}
            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={toggleOrigin} title={showOrigin ? "Hide source badges" : "Show source badges"}>
              {showOrigin ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 pt-6 space-y-6">
        {survey.slug && (
          <ShareLinkCard slug={survey.slug} />
        )}

        <Card className="rounded-2xl border-border/70">
          <CardContent className="p-5 space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Input value={survey.title_en} onChange={(e) => updateMeta({ title_en: e.target.value })} placeholder="Survey title (English)" className="h-11 rounded-xl font-medium" />
              <Input value={survey.title_te ?? ""} onChange={(e) => updateMeta({ title_te: e.target.value })} placeholder="సర్వే శీర్షిక (తెలుగు)" className="h-11 rounded-xl" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Textarea value={survey.description_en ?? ""} onChange={(e) => updateMeta({ description_en: e.target.value })} placeholder="Description (English)" rows={2} className="rounded-xl text-sm" />
              <Textarea value={survey.description_te ?? ""} onChange={(e) => updateMeta({ description_te: e.target.value })} placeholder="వివరణ (తెలుగు)" rows={2} className="rounded-xl text-sm" />
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Questions</h2>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setPdfOpen(true)}>
                <FileUp className="h-3.5 w-3.5 mr-1.5" /> Import from PDF
              </Button>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setVoiceOpen(true)}>
                <Mic className="h-3.5 w-3.5 mr-1.5" /> Add by voice
              </Button>
            </div>
          </div>

          {questions.length === 0 ? (
            <Card className="rounded-2xl border-dashed border-border/70">
              <EmptyState icon={FileQuestion} title="No questions yet" body="Add your first question to start building this survey." />
            </Card>
          ) : (
            <SortableQuestionList
              questions={questions}
              onReorder={handleReorder}
              onChangeField={handleChangeField}
              onChangeKind={handleChangeKind}
              onDelete={handleDeleteQuestion}
              onDuplicate={handleDuplicateQuestion}
              onAddOption={handleAddOption}
              onUpdateOption={handleUpdateOption}
              onDeleteOption={handleDeleteOption}
              onMoveOption={handleMoveOption}
            />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="mt-4 w-full rounded-xl h-12 border-dashed">
                <Plus className="h-4 w-4 mr-1.5" /> Add question <ChevronDown className="h-3.5 w-3.5 ml-1.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              {QUESTION_KINDS.map((k) => (
                <DropdownMenuItem key={k.value} onClick={() => handleAddQuestion(k.value)} className="gap-2">
                  <QuestionTypeIcon kind={k.value} className="h-4 w-4 text-primary" /> {k.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ImportPdfDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        surveyId={survey.id}
        existingQuestions={questions}
        onImported={(created) => setQuestions((qs) => [...(qs ?? []), ...created])}
      />
      <VoiceDialog
        open={voiceOpen}
        onOpenChange={setVoiceOpen}
        surveyId={survey.id}
        onCreated={(q) => setQuestions((qs) => [...(qs ?? []), q])}
      />
    </div>
  );
}
