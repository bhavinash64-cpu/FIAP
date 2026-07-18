import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Lock, SearchX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { WelcomeStage, ConsentStage, InstructionsStage } from "@/components/assessment/IntroStages";
import { QuestionStage } from "@/components/assessment/QuestionStage";
import { ReviewStage } from "@/components/assessment/ReviewStage";
import { ThankYouStage } from "@/components/assessment/ThankYouStage";
import {
  getPublicSurvey,
  submitSurveyResponse,
  trackSurveyView,
  type AnswerValue,
  type PublicSurveyState,
} from "@/lib/surveys";
import {
  clearSession,
  estimateSeconds,
  firstUnansweredIndex,
  formatReferenceId,
  loadSession,
  loadSubmission,
  minutesFromSeconds,
  saveSession,
  saveSubmission,
  type Stage,
} from "@/lib/assessmentSession";
import { renderBilingual, useLangMode, useT } from "@/lib/i18n";

const EASE = [0.33, 1, 0.68, 1] as const;

/**
 * The guided assessment.
 *
 * Welcome → Consent → Instructions → one question per screen → Review → Thank you.
 *
 * Every question is already in memory: getPublicSurvey() returns the whole
 * instrument in one round trip, so moving between questions is a state change
 * and nothing else. There is no per-question fetch to prefetch, and no loading
 * state that could flash between screens.
 */
export default function SurveyRunner() {
  const { slug } = useParams();
  const mode = useLangMode();
  const t = useT();

  const [state, setState] = useState<PublicSurveyState | "loading" | "error">("loading");
  const [stage, setStage] = useState<Stage>("welcome");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<{ referenceId: string; submittedAt: string } | null>(null);
  /** True only when a saved draft was found, so Welcome can offer to resume. */
  const [resumable, setResumable] = useState(false);

  const submitLock = useRef(false);
  const viewTracked = useRef(false);
  const startedAt = useRef<Date | null>(null);

  const surveyId = typeof state === "string" ? null : state.kind === "open" ? state.survey.id : null;

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getPublicSurvey(slug)
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState("error"));
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // ── Restore a draft, or a completed submission ───────────────────────────
  useEffect(() => {
    if (!surveyId) return;

    const done = loadSubmission(surveyId);
    if (done) {
      setSubmission({ referenceId: done.referenceId, submittedAt: done.submittedAt });
      setStage("done");
      return;
    }

    const saved = loadSession(surveyId);
    if (saved && Object.keys(saved.answers).length > 0) {
      setAnswers(saved.answers);
      setIndex(saved.index);
      setConsented(saved.consented);
      startedAt.current = new Date(saved.startedAt);
      setResumable(true);
    }
  }, [surveyId]);

  useEffect(() => {
    if (!surveyId || viewTracked.current) return;
    viewTracked.current = true;
    if (!startedAt.current) startedAt.current = new Date();
    trackSurveyView(surveyId);
  }, [surveyId]);

  // ── Autosave ────────────────────────────────────────────────────────────
  // Writes on every answer and every move. localStorage.setItem is synchronous
  // but these payloads are small, and debouncing would risk losing the last
  // answer if the browser is closed right after it — the exact moment resume
  // exists to cover.
  useEffect(() => {
    if (!surveyId || stage === "done" || stage === "welcome") return;
    saveSession(surveyId, {
      answers,
      index,
      stage,
      consented,
      startedAt: (startedAt.current ?? new Date()).toISOString(),
    });
  }, [surveyId, answers, index, stage, consented]);

  const questions = useMemo(
    () => (typeof state !== "string" && state.kind === "open" ? state.questions : []),
    [state],
  );

  const estimatedMinutes = useMemo(() => minutesFromSeconds(estimateSeconds(questions)), [questions]);

  const setAnswer = useCallback((id: string, v: AnswerValue) => {
    setAnswers((prev) => ({ ...prev, [id]: v }));
  }, []);

  async function handleSubmit() {
    if (submitLock.current || !surveyId) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const id = await submitSurveyResponse(surveyId, mode, answers, startedAt.current ?? undefined);
      const record = { referenceId: formatReferenceId(id), submittedAt: new Date().toISOString() };
      saveSubmission(surveyId, record);
      clearSession(surveyId);
      setSubmission(record);
      setStage("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("submitFailed"));
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  // ── Status screens ──────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  if (state === "error") {
    return <StatusScreen icon={SearchX} title={t("somethingWrongTitle")} body={t("somethingWrongBody")} />;
  }

  if (state.kind === "not_found") {
    return <StatusScreen icon={SearchX} title={t("surveyNotFoundTitle")} body={t("surveyNotFoundBody")} />;
  }

  if (state.kind === "closed") {
    const title = renderBilingual(mode, state.survey.title_en, state.survey.title_te).primary;
    return <StatusScreen icon={Lock} title={t("surveyClosedTitle")} body={t("surveyClosedBody", { title })} />;
  }

  const { survey } = state;

  if (stage === "done" && submission) {
    return (
      <ThankYouStage
        survey={survey}
        mode={mode}
        referenceId={submission.referenceId}
        submittedAt={submission.submittedAt}
      />
    );
  }

  if (!questions.length) {
    return <StatusScreen icon={SearchX} title={survey.title_en} body={t("noQuestionsYet")} />;
  }

  // ── Stages ──────────────────────────────────────────────────────────────

  if (stage === "welcome") {
    return (
      <WelcomeStage
        survey={survey}
        mode={mode}
        minutes={estimatedMinutes}
        questionCount={questions.length}
        canResume={resumable}
        onBegin={() => {
          startedAt.current = new Date();
          setStage("consent");
        }}
        onResume={() => {
          // Consent already given on the earlier visit — don't make a returning
          // parent re-read and re-affirm it. Land them on the first question
          // they haven't answered rather than wherever they happened to stop.
          const next = firstUnansweredIndex(questions, answers);
          setIndex(next === -1 ? Math.min(index, questions.length - 1) : next);
          setStage(consented ? "questions" : "consent");
        }}
        onStartOver={() => {
          clearSession(survey.id);
          setAnswers({});
          setIndex(0);
          setConsented(false);
          setResumable(false);
          startedAt.current = new Date();
          setStage("consent");
        }}
      />
    );
  }

  if (stage === "consent") {
    return (
      <ConsentStage
        onAgree={() => {
          setConsented(true);
          setStage("instructions");
        }}
        onBack={() => setStage("welcome")}
      />
    );
  }

  if (stage === "instructions") {
    return <InstructionsStage onStart={() => setStage("questions")} onBack={() => setStage("consent")} />;
  }

  if (stage === "review") {
    return (
      <ReviewStage
        questions={questions}
        answers={answers}
        mode={mode}
        submitting={submitting}
        onEdit={(i) => {
          setIndex(i);
          setStage("questions");
        }}
        onBack={() => {
          setIndex(questions.length - 1);
          setStage("questions");
        }}
        onSubmit={handleSubmit}
      />
    );
  }

  return (
    <QuestionStage
      questions={questions}
      index={Math.min(index, questions.length - 1)}
      answers={answers}
      mode={mode}
      onAnswer={setAnswer}
      onNavigate={setIndex}
      onBackToIntro={() => setStage("instructions")}
      onReview={() => setStage("review")}
    />
  );
}

function StatusScreen({ icon: Icon, title, body }: { icon: typeof SearchX; title: string; body: string }) {
  const t = useT();
  const reduce = useReducedMotion();
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-5 sm:px-6">
          <Logo size={36} />
          <div className="t-caption font-semibold text-muted-foreground">{t("appShort")}</div>
          <div className="ml-auto">
            <LangToggle size="sm" />
          </div>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="max-w-sm text-center"
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 t-section">{title}</h1>
          <p className="mt-2 t-body text-muted-foreground">{body}</p>
        </motion.div>
      </div>
    </div>
  );
}
