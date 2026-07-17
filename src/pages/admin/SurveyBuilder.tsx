import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion, useSpring, useMotionValue } from "framer-motion";
import { ArrowLeft, Loader2, Check, Plus, Eye, Rocket, Lock, LockOpen, ChevronDown, FileUp, Mic, EyeOff, BarChart3, Library, FileQuestion, GripVertical, Send, X, Settings, ChevronUp, ChevronDown as ChevronDownIcon, Globe, MessageSquare, Sparkles, Smartphone, Tablet, Monitor, Zap, Wand2, Heart, Shield, CheckCircle2, Square, Volume2, Languages, Keyboard, Touchpad, Command as CmdIcon, Search, Mic2, Zap as ZapIcon, Wand2 as WandIcon, LayoutDashboard, Users, Settings as SettingsIcon, HelpCircle, ChevronRight, ChevronLeft, Sun, Moon, Palette, Type, Layers, RotateCcw, Copy, Save, Share2, Download, Upload, Trash2, Edit, Maximize2, Minimize2, Grid, List, Filter, SortAsc, SortDesc } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { ShareLinkCard } from "@/components/survey/ShareLinkCard";
import { SortableQuestionList } from "@/components/survey/SortableQuestionList";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { QuestionCardSkeleton } from "@/components/survey/Skeletons";
import { ImportPdfDialog } from "@/components/survey/ImportPdfDialog";
import { VoiceDialog } from "@/components/survey/VoiceDialog";
import { QuestionLibraryDialog } from "@/components/survey/QuestionLibraryDialog";
import { useOriginVisibility } from "@/components/survey/OriginBadge";
import { easeOut, spring } from "@/lib/motion";
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
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Command, CommandInput, CommandList, CommandItem, CommandGroup, CommandSeparator } from "@/components/ui/command";
import { create } from "zustand";

type SaveState = "idle" | "saving" | "saved";

interface LanguageState {
  mode: "en" | "te";
  setMode: (mode: "en" | "te") => void;
}

const useLanguageStore = create<LanguageState>((set) => ({
  mode: "en",
  setMode: (mode) => set({ mode }),
}));

export default function SurveyBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const reduceMotion = useReducedMotion();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [publishing, setPublishing] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [translating, setTranslating] = useState<Record<string, boolean>>({});
  const showOrigin = useOriginVisibility((s) => s.visible);
  const toggleOrigin = useOriginVisibility((s) => s.toggle);
  const metaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const questionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [isMobile, setIsMobile] = useState(false);

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
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-4">
        <QuestionCardSkeleton />
        <QuestionCardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Sticky Toolbar */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm shadow-sm">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 flex items-center gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/surveys"><ArrowLeft className="h-4 w-4" strokeWidth={1.5} />Surveys</Link>
          </Button>
          <StatusBadge status={survey.status} />
          <div className="t-caption text-muted-foreground w-24">
            {saveState === "saving" && <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" />Saving…</span>}
            {saveState === "saved" && (
              <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="inline-flex items-center gap-1 text-success">
                <Check className="h-3 w-3" />Saved
              </motion.span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/surveys/${survey.id}/analytics`}><BarChart3 className="h-4 w-4" strokeWidth={1.5} />Analytics</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/surveys/${survey.id}/preview`}><Eye className="h-4 w-4" strokeWidth={1.5} />Preview</Link>
            </Button>
            {survey.status === "draft" && (
              <Button size="sm" onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" strokeWidth={1.5} />}Publish
              </Button>
            )}
            {survey.status === "published" && (
              <Button size="sm" variant="outline" onClick={handleClose}><Lock className="h-4 w-4" strokeWidth={1.5} />Close</Button>
            )}
            {survey.status === "closed" && (
              <Button size="sm" variant="outline" onClick={handleReopen}><LockOpen className="h-4 w-4" strokeWidth={1.5} />Reopen</Button>
            )}
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={toggleOrigin} title={showOrigin ? "Hide source badges" : "Show source badges"}>
              {showOrigin ? <Eye className="h-4 w-4" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4" strokeWidth={1.5} />}
            </Button>
            <Button size="icon" variant="ghost" className="h-9 w-9 mobile-only" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}>
              {sidebarOpen ? <X className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-6 pb-24">
        {survey.slug && (
          <ShareLinkCard slug={survey.slug} />
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          {/* Main Canvas */}
          <div className="space-y-6">
            {/* Survey Meta Card */}
            <Card className="overflow-hidden">
              <CardHeader className="pb-2">
                <span className="eyebrow text-primary">Details</span>
              </CardHeader>
              <CardContent className="space-y-6 pt-0">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input value={survey.title_en} onChange={(e) => updateMeta({ title_en: e.target.value })} placeholder="Survey title (English)" className="font-medium" />
                  <Input value={survey.title_te ?? ""} onChange={(e) => updateMeta({ title_te: e.target.value })} placeholder="సర్వే శీర్షిక (తెలుగు)" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Textarea value={survey.description_en ?? ""} onChange={(e) => updateMeta({ description_en: e.target.value })} placeholder="Description (English)" rows={2} />
                  <Textarea value={survey.description_te ?? ""} onChange={(e) => updateMeta({ description_te: e.target.value })} placeholder="వివరణ (తెలుగు)" rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Questions Section */}
            <div>
              <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                <h2 className="t-section">Questions</h2>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => setLibraryOpen(true)}>
                    <Library className="h-4 w-4" strokeWidth={1.5} /> Question library
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setPdfOpen(true)}>
                    <FileUp className="h-4 w-4" strokeWidth={1.5} /> Import PDF
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setVoiceOpen(true)}>
                    <Mic className="h-4 w-4" strokeWidth={1.5} /> Voice
                  </Button>
                </div>
              </div>

              {questions.length === 0 ? (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: easeOut }}
                  className="flex flex-col items-center rounded-surface border border-dashed border-border bg-card px-6 py-24 text-center shadow-[var(--highlight-top),var(--shadow-sm)]"
                >
                  <div className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
                    <FileQuestion className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <h3 className="mt-6 t-section">No questions yet</h3>
                  <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">Add your first question to start building this survey.</p>
                </motion.div>
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
                  <Button variant="outline" className="mt-4 w-full h-12 border-dashed">
                    <Plus className="h-4 w-4" strokeWidth={1.5} /> Add question <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.5} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" className="w-64">
                  {QUESTION_KINDS.map((k) => (
                    <DropdownMenuItem key={k.value} onClick={() => handleAddQuestion(k.value)} className="gap-2">
                      <QuestionTypeIcon kind={k.value} className="h-4 w-4 text-muted-foreground" /> {k.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Sidebar: Quick Actions & Stats */}
          <aside className="lg:sticky lg:top-24 lg:self-start space-y-4 hidden lg:block">
            <Card className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="grid h-9 w-9 place-items-center rounded-control bg-accent-tint">
                  <FileQuestion className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="t-card font-semibold">Quick Actions</div>
                  <div className="t-caption text-muted-foreground">Common operations</div>
                </div>
              </div>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleAddQuestion("multiple_choice")}>
                  <QuestionTypeIcon kind="multiple_choice" className="h-4 w-4" /> Multiple Choice
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleAddQuestion("likert5")}>
                  <QuestionTypeIcon kind="likert5" className="h-4 w-4" /> Likert 5-point
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleAddQuestion("rating5")}>
                  <QuestionTypeIcon kind="rating5" className="h-4 w-4" /> Rating 1–5
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleAddQuestion("short_text")}>
                  <QuestionTypeIcon kind="short_text" className="h-4 w-4" /> Short Text
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleAddQuestion("long_text")}>
                  <QuestionTypeIcon kind="long_text" className="h-4 w-4" /> Long Text
                </Button>
                <Button variant="outline" className="w-full justify-start gap-3" onClick={() => handleAddQuestion("yes_no")}>
                  <QuestionTypeIcon kind="yes_no" className="h-4 w-4" /> Yes / No
                </Button>
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="grid h-9 w-9 place-items-center rounded-control bg-success/10">
                  <Check className="h-5 w-5 text-success" strokeWidth={1.5} />
                </div>
                <div>
                  <div className="t-card font-semibold">Completion</div>
                  <div className="t-caption text-muted-foreground">Estimate & preview</div>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Questions</span>
                  <span className="font-semibold text-foreground">{questions.length}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Est. time</span>
                  <span className="font-semibold text-foreground">{Math.max(1, Math.round(questions.length * 0.8))} min</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Languages</span>
                  <span className="font-semibold text-foreground">English, Telugu</span>
                </div>
              </div>
            </Card>

            {survey.slug && (
              <Card className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="grid h-9 w-9 place-items-center rounded-control bg-primary-tint">
                    <Send className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="t-card font-semibold">Share Link</div>
                    <div className="t-caption text-muted-foreground">Public, no login</div>
                  </div>
                </div>
                <ShareLinkCard slug={survey.slug} />
              </Card>
            )}
          </aside>
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-foreground/25 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
            <motion.aside initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", stiffness: 360, damping: 36 }} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[360px] flex-col border-l border-border/70 bg-card p-3 lg:hidden safe-area-inset">
              <button onClick={() => setSidebarOpen(false)} className="mb-1 mr-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-muted touch-target">
                <X className="h-4 w-4" />
              </button>
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="grid h-9 w-9 place-items-center rounded-control bg-accent-tint">
                      <FileQuestion className="h-5 w-5 text-primary" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="t-card font-semibold">Quick Actions</div>
                      <div className="t-caption text-muted-foreground">Common operations</div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { handleAddQuestion("multiple_choice"); setSidebarOpen(false); }}>
                      <QuestionTypeIcon kind="multiple_choice" className="h-4 w-4" /> Multiple Choice
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { handleAddQuestion("likert5"); setSidebarOpen(false); }}>
                      <QuestionTypeIcon kind="likert5" className="h-4 w-4" /> Likert 5-point
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { handleAddQuestion("rating5"); setSidebarOpen(false); }}>
                      <QuestionTypeIcon kind="rating5" className="h-4 w-4" /> Rating 1–5
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { handleAddQuestion("short_text"); setSidebarOpen(false); }}>
                      <QuestionTypeIcon kind="short_text" className="h-4 w-4" /> Short Text
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { handleAddQuestion("long_text"); setSidebarOpen(false); }}>
                      <QuestionTypeIcon kind="long_text" className="h-4 w-4" /> Long Text
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-3" onClick={() => { handleAddQuestion("yes_no"); setSidebarOpen(false); }}>
                      <QuestionTypeIcon kind="yes_no" className="h-4 w-4" /> Yes / No
                    </Button>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="grid h-9 w-9 place-items-center rounded-control bg-success/10">
                      <Check className="h-5 w-5 text-success" strokeWidth={1.5} />
                    </div>
                    <div>
                      <div className="t-card font-semibold">Completion</div>
                      <div className="t-caption text-muted-foreground">Estimate & preview</div>
                    </div>
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Questions</span>
                      <span className="font-semibold text-foreground">{questions.length}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Est. time</span>
                      <span className="font-semibold text-foreground">{Math.max(1, Math.round(questions.length * 0.8))} min</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Languages</span>
                      <span className="font-semibold text-foreground">English, Telugu</span>
                    </div>
                  </div>
                </Card>

                {survey.slug && (
                  <Card className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="grid h-9 w-9 place-items-center rounded-control bg-primary-tint">
                        <Send className="h-5 w-5 text-primary" strokeWidth={1.5} />
                      </div>
                      <div>
                        <div className="t-card font-semibold">Share Link</div>
                        <div className="t-caption text-muted-foreground">Public, no login</div>
                      </div>
                    </div>
                    <ShareLinkCard slug={survey.slug} />
                  </Card>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

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
      <QuestionLibraryDialog
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        surveyId={survey.id}
        onImported={(created) => setQuestions((qs) => [...(qs ?? []), ...created])}
      />
    </div>
  );
}
