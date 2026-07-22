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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useBuilderStore, selectVisibleIds, flushAutosave, hasPendingWrites } from "@/stores/builderStore";
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

  const saveState = useBuilderStore((s) => s.saveState);

  const showOrigin = useOriginVisibility((s) => s.visible);
  const toggleOrigin = useOriginVisibility((s) => s.toggle);

  const [pdfOpen, setPdfOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

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

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await flushAutosave();
      toast.success("All changes saved");
    } catch {
      toast.error("Could not save. Check your connection — your edits are still on screen.");
    } finally {
      setSaving(false);
    }
  }, []);

  /**
   * Leaving with writes still in the air.
   *
   * The unmount effect already flushes, but that is a promise nobody is waiting
   * on — a route change tears the component down and the request can be
   * abandoned mid-flight, or fail with no one left to see the toast. So if
   * anything is pending or the last save errored, ask first. When everything is
   * settled this is a plain back button with no dialog, because a confirmation
   * that fires when there is nothing to confirm is the fastest way to teach
   * someone to dismiss confirmations without reading them.
   */
  const handleBack = useCallback(() => {
    if (hasPendingWrites() || saveState === "error") setLeaveOpen(true);
    else nav("/app/surveys");
  }, [nav, saveState]);

  const leaveAnyway = useCallback(() => {
    setLeaveOpen(false);
    nav("/app/surveys");
  }, [nav]);

  const saveThenLeave = useCallback(async () => {
    setSaving(true);
    try {
      await flushAutosave();
      setLeaveOpen(false);
      nav("/app/surveys");
    } catch {
      toast.error("Still could not save. Your edits are on screen — try again.");
    } finally {
      setSaving(false);
    }
  }, [nav]);

  // Closing the tab is the one exit React Router cannot intercept.
  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (!hasPendingWrites() && saveState !== "error") return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saveState]);

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
    <div className="bg-canvas">
      {/*
        Docked UNDER the app topbar, not at top:0.

        Both bars were `sticky top-0`, so the builder's toolbar rendered as a
        second full-width bar sitting on top of the shell's — two stacked pieces
        of chrome with two different backgrounds, competing for the same job.
        Pinning this one at the topbar's height and giving it the SAME material
        (canvas + blur, one divider at the bottom) makes the pair read as a
        single header block, while Save and Publish stay reachable without
        scrolling back up.
      */}
      <div className="sticky top-[var(--topbar-h)] z-20 border-b border-border bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            Surveys
          </Button>
          <StatusBadge status={survey.status} />
          <SaveIndicator />

          <div className="ml-auto flex items-center gap-2">
            {/*
              Edits already autosave 400ms after you stop typing, so this button
              is not what makes them persist. It exists because "did that
              actually save?" is the question people ask before closing a laptop,
              and a status word alone does not answer it — pressing something and
              watching it settle to Saved does. It flushes every pending write
              immediately rather than waiting out the debounce.
            */}
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={1.8} />}
              Save
            </Button>
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
              <div className="sticky top-[calc(var(--topbar-h)+3.5rem)] max-h-[calc(100dvh-var(--topbar-h)-5rem)] overflow-y-auto rounded-surface border border-border/70 bg-muted/30 p-4">
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

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              {saveState === "error"
                ? "The last change could not be saved. If you leave now it will be lost."
                : "Some changes are still being saved. If you leave now they may be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Stay on this page</AlertDialogCancel>
            {/* Save-and-leave is the primary action, not "leave anyway".
                Discarding work should never be the easiest button to hit. */}
            <Button variant="ghost" onClick={leaveAnyway} disabled={saving}>
              Leave anyway
            </Button>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void saveThenLeave(); }} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save and leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
