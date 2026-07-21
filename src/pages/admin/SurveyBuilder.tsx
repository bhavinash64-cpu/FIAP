import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  FileUp,
  Loader2,
  Lock,
  LockOpen,
  Mic,
  Library,
  Plus,
  Rocket,
  Rows3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { SurveyShareCard } from "@/components/share/SurveyShareCard";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { QuestionCardSkeleton } from "@/components/survey/Skeletons";
import { ImportPdfDialog } from "@/components/survey/ImportPdfDialog";
import { VoiceDialog } from "@/components/survey/VoiceDialog";
import { QuestionLibraryDialog } from "@/components/survey/QuestionLibraryDialog";
import { useOriginVisibility } from "@/components/survey/OriginBadge";
import { AutoTextarea } from "@/components/survey/builder/AutoTextarea";
import { BuilderFilters } from "@/components/survey/builder/BuilderFilters";
import { QuestionList } from "@/components/survey/builder/QuestionList";
import { InlinePreview } from "@/components/survey/builder/InlinePreview";
import { useBuilderStore, selectVisibleIds, flushAutosave } from "@/stores/builderStore";
import { QUESTION_KINDS, closeSurvey, publishSurvey, reopenSurvey } from "@/lib/surveys";
import { useLangMode } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Save indicator. Split out so its state changes never re-render the list. */
function SaveIndicator() {
  const saveState = useBuilderStore((s) => s.saveState);
  if (saveState === "idle") return null;
  return (
    <span className="inline-flex w-20 items-center gap-1 t-caption text-muted-foreground">
      {saveState === "saving" && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving…
        </>
      )}
      {saveState === "saved" && (
        <span className="inline-flex items-center gap-1 text-success">
          <Check className="h-3 w-3" />
          Saved
        </span>
      )}
      {saveState === "error" && (
        <span className="inline-flex items-center gap-1 text-destructive">
          <AlertCircle className="h-3 w-3" />
          Not saved
        </span>
      )}
    </span>
  );
}

/** Survey title/description. Isolated so meta typing doesn't touch the question list. */
function SurveyMeta() {
  const survey = useBuilderStore((s) => s.survey);
  const setMeta = useBuilderStore((s) => s.setMeta);
  if (!survey) return null;
  return (
    <div className="space-y-1 border-b border-border/70 pb-5">
      <AutoTextarea
        value={survey.title_en}
        onChange={(e) => setMeta({ title_en: e.target.value })}
        placeholder="Untitled survey"
        className="t-title text-foreground"
        aria-label="Survey title (English)"
      />
      <AutoTextarea
        value={survey.title_te ?? ""}
        onChange={(e) => setMeta({ title_te: e.target.value })}
        placeholder="సర్వే శీర్షిక (తెలుగు)"
        className="t-section text-muted-foreground"
        aria-label="Survey title (Telugu)"
      />
      <AutoTextarea
        value={survey.description_en ?? ""}
        onChange={(e) => setMeta({ description_en: e.target.value })}
        placeholder="Add a description…"
        className="t-body text-muted-foreground"
        aria-label="Survey description (English)"
      />
    </div>
  );
}

export default function SurveyBuilder() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const mode = useLangMode();

  const loading = useBuilderStore((s) => s.loading);
  const survey = useBuilderStore((s) => s.survey);
  const total = useBuilderStore((s) => s.order.length);
  const visibleCount = useBuilderStore(useShallow(selectVisibleIds)).length;
  const load = useBuilderStore((s) => s.load);
  const reset = useBuilderStore((s) => s.reset);
  const addQuestion = useBuilderStore((s) => s.addQuestion);
  const addSectionAt = useBuilderStore((s) => s.addSectionAt);
  const ingest = useBuilderStore((s) => s.ingest);
  const setSurveyStatus = useBuilderStore((s) => s.setSurveyStatus);

  const showOrigin = useOriginVisibility((s) => s.visible);
  const toggleOrigin = useOriginVisibility((s) => s.toggle);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);

  useEffect(() => {
    if (id) load(id);
    return () => {
      // Never navigate away with an unsent keystroke.
      void flushAutosave();
      reset();
    };
  }, [id, load, reset]);

  // A survey id that resolves to nothing is a dead link — bounce to the list.
  useEffect(() => {
    if (!loading && !survey) nav("/app/surveys");
  }, [loading, survey, nav]);

  const handlePublish = useCallback(async () => {
    if (!survey) return;
    if (total === 0) return toast.error("Add at least one question before publishing.");
    setPublishing(true);
    try {
      await flushAutosave();
      const slug = await publishSurvey(survey.id);
      setSurveyStatus({ status: "published", slug, published_at: new Date().toISOString() });
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success("Survey published");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }, [survey, total, setSurveyStatus, qc]);

  const handleClose = useCallback(async () => {
    if (!survey) return;
    await closeSurvey(survey.id);
    setSurveyStatus({ status: "closed" });
    qc.invalidateQueries({ queryKey: ["surveys"] });
    toast.success("Survey closed to new responses");
  }, [survey, setSurveyStatus, qc]);

  const handleReopen = useCallback(async () => {
    if (!survey) return;
    await reopenSurvey(survey.id);
    setSurveyStatus({ status: "published" });
    qc.invalidateQueries({ queryKey: ["surveys"] });
    toast.success("Survey reopened");
  }, [survey, setSurveyStatus, qc]);

  if (loading || !survey) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 sm:px-6">
        <QuestionCardSkeleton />
        <QuestionCardSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2.5 sm:px-6">
          <Button asChild variant="ghost" size="sm">
            <Link to="/app/surveys">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              Surveys
            </Link>
          </Button>
          <StatusBadge status={survey.status} />
          <SaveIndicator />

          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant={previewOpen ? "secondary" : "outline"}
              onClick={() => setPreviewOpen((v) => !v)}
              className="hidden lg:inline-flex"
            >
              {previewOpen ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
              Preview
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/surveys/${survey.id}/analytics`}>
                <BarChart3 className="h-4 w-4" strokeWidth={1.5} />
                Analytics
              </Link>
            </Button>
            {survey.status === "draft" && (
              <Button size="sm" onClick={handlePublish} disabled={publishing}>
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" strokeWidth={1.5} />}
                Publish
              </Button>
            )}
            {survey.status === "published" && (
              <Button size="sm" variant="outline" onClick={handleClose}>
                <Lock className="h-4 w-4" strokeWidth={1.5} />
                Close
              </Button>
            )}
            {survey.status === "closed" && (
              <Button size="sm" variant="outline" onClick={handleReopen}>
                <LockOpen className="h-4 w-4" strokeWidth={1.5} />
                Reopen
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={toggleOrigin}
              title={showOrigin ? "Hide source badges" : "Show source badges"}
              aria-label={showOrigin ? "Hide source badges" : "Show source badges"}
            >
              {showOrigin ? <Eye className="h-4 w-4" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4" strokeWidth={1.5} />}
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 pb-32 pt-5 sm:px-6">
        {survey.slug && (
          <div className="mb-6">
            <SurveyShareCard survey={survey} mode={mode} />
          </div>
        )}

        <div className={cn("grid gap-6", previewOpen && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
          {/* Editor canvas */}
          <div className="min-w-0 space-y-4">
            <SurveyMeta />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <BuilderFilters visibleCount={visibleCount} total={total} />
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="ghost" onClick={() => addSectionAt()} className="t-caption">
                  <Rows3 className="h-3.5 w-3.5" strokeWidth={1.5} /> Section
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setLibraryOpen(true)} className="t-caption">
                  <Library className="h-3.5 w-3.5" strokeWidth={1.5} /> Library
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setPdfOpen(true)} className="t-caption">
                  <FileUp className="h-3.5 w-3.5" strokeWidth={1.5} /> PDF
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setVoiceOpen(true)} className="t-caption">
                  <Mic className="h-3.5 w-3.5" strokeWidth={1.5} /> Voice
                </Button>
              </div>
            </div>

            <QuestionList />

            {/* One click adds a question; the split button picks a type without a dialog. */}
            <div className="flex gap-1.5 pt-1">
              <Button variant="outline" className="h-11 flex-1 justify-start border-dashed" onClick={() => addQuestion()}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Add question
                <kbd className="ml-auto hidden rounded border border-border/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                  Enter
                </kbd>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="h-11 border-dashed px-3" aria-label="Add a question of a specific type">
                    <QuestionTypeIcon kind="multiple_choice" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {QUESTION_KINDS.map((k) => (
                    <DropdownMenuItem key={k.value} onClick={() => addQuestion(k.value)} className="gap-2">
                      <QuestionTypeIcon kind={k.value} className="h-4 w-4 text-muted-foreground" />
                      {k.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Live preview */}
          {previewOpen && (
            <aside className="hidden lg:block">
              <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-surface border border-border/70 bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="eyebrow text-primary">Live preview</span>
                  <span className="t-caption text-muted-foreground">as parents see it</span>
                </div>
                <InlinePreview mode="en" />
              </div>
            </aside>
          )}
        </div>
      </div>

      <ImportPdfDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        surveyId={survey.id}
        existingQuestions={Object.values(useBuilderStore.getState().byId)}
        onImported={ingest}
      />
      <VoiceDialog open={voiceOpen} onOpenChange={setVoiceOpen} surveyId={survey.id} onCreated={(q) => ingest([q])} />
      <QuestionLibraryDialog open={libraryOpen} onOpenChange={setLibraryOpen} surveyId={survey.id} onImported={ingest} />
    </div>
  );
}
