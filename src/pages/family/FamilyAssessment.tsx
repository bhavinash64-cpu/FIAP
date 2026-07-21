import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, CloudOff, LogOut, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Logo } from "@/components/Logo";
import { AssessmentChromeProvider } from "@/components/assessment/AssessmentChrome";
import { QuestionStage } from "@/components/assessment/QuestionStage";
import { ReviewStage } from "@/components/assessment/ReviewStage";
import { FamilyExpiredStage } from "@/components/family/FamilyExpiredStage";
import { FamilyThankYouStage } from "@/components/family/FamilyThankYouStage";
import { FamilyWelcomeStage } from "@/components/family/FamilyWelcomeStage";
import { emojiForAnswer } from "@/lib/answerVisuals";
import {
  clearSession,
  emptyMeta,
  estimateSeconds,
  firstUnansweredIndex,
  isAnswered,
  minutesFromSeconds,
  saveSession,
  type AnswerMeta,
  type Stage,
} from "@/lib/assessmentSession";
import {
  FamilyAccessError,
  familySignOut,
  resumeFamilySession,
  saveFamilyDraft,
  submitFamilyAssessment,
  type AssessmentBundle,
  type RespondentDraft,
  type SubmissionReceipt,
} from "@/lib/familyAccess";
import { useLangMode, useT } from "@/lib/i18n";
import type { AnswerValue } from "@/lib/surveys";
import { cn } from "@/lib/utils";

/**
 * The credentialled family assessment — the entire product for a respondent.
 *
 * The rule that governs this file: there is exactly one destination behind the
 * PIN, and it is this page. No navigation, no menu, no profile, no dashboard,
 * no link out of here except the deliberate "Leave" action that ends the
 * session. Adding any outbound link would break the access model, because the
 * respondent's token grants precisely one thing — their own assessment — and a
 * link implies a place to go that a family is not a principal for.
 *
 * Everything arrives in one round trip: resumeFamilySession() returns the case,
 * the instrument, the draft and (if it exists) the receipt, so moving between
 * questions is a state change and nothing else.
 */

const EASE = [0.33, 1, 0.68, 1] as const;

/**
 * Server autosave delay. Long enough that typing a long-text answer is one
 * request rather than forty, short enough that putting the phone down for a
 * moment is already enough to have crossed devices.
 */
const SERVER_SAVE_MS = 1200;

/**
 * No consent stage and no instructions stage.
 *
 * A field officer sat with this family, explained the study and took written
 * consent on paper before the case was ever created. Re-asking on a phone is a
 * second consent ceremony for the same act — it implies the paper one did not
 * count, and it puts a tick-box between a grieving family and the thing they
 * already agreed to do. The welcome screen still states confidentiality and
 * voluntariness; it just does not ask them to re-affirm it.
 */
type LocalStage = "welcome" | "questions" | "review" | "done";

type UnavailableReason = "session" | "expired" | "unavailable";

/**
 * A draft can only have been written by this page, but `Stage` is the wider
 * public-runner union, so it is narrowed rather than cast.
 */
function localStage(stage: Stage): LocalStage {
  if (stage === "questions" || stage === "review") return stage;
  // "done" in a draft that the server has no receipt for means the submit
  // itself failed. Put the family back on Review, where the button is, rather
  // than at the start of an instrument they have already finished.
  if (stage === "done") return "review";
  return "welcome";
}

export default function FamilyAssessment() {
  const navigate = useNavigate();
  const mode = useLangMode();
  const t = useT();
  const reduce = useReducedMotion();

  const [bundle, setBundle] = useState<AssessmentBundle | null>(null);
  const [unavailable, setUnavailable] = useState<UnavailableReason | null>(null);

  const [stage, setStage] = useState<LocalStage>("welcome");
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [meta, setMeta] = useState<Record<string, AnswerMeta>>({});
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<SubmissionReceipt | null>(null);
  /** True only when a draft carried at least one answer, so Welcome can offer to resume. */
  const [canResume, setCanResume] = useState(false);

  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  /** null until the first save of the session — the indicator stays silent before that. */
  const [saveState, setSaveState] = useState<"synced" | "local" | null>(null);

  const submitLock = useRef(false);
  const startedAt = useRef<string>(new Date().toISOString());
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ── Load ────────────────────────────────────────────────────────────────

  const adopt = useCallback((next: AssessmentBundle) => {
    if (next.draft) {
      setAnswers(next.draft.answers ?? {});
      setMeta(next.draft.meta ?? {});
      setIndex(Math.max(0, next.draft.index ?? 0));
      setStage(localStage(next.draft.stage));
      startedAt.current = next.draft.startedAt || startedAt.current;
      setCanResume(Object.keys(next.draft.answers ?? {}).length > 0);
    }
    setBundle(next);
  }, []);

  const load = useCallback(async () => {
    try {
      const next = await resumeFamilySession();
      if (!aliveRef.current) return;

      // No survey, or a survey with nothing in it, is not something a family
      // can be asked to do anything about — it is a research-side problem, and
      // the honest screen is the same one an expired case gets. It comes first
      // because even the acknowledgement sheet names the instrument.
      if (!next.survey) {
        setUnavailable("unavailable");
        return;
      }

      // A receipt outranks the draft entirely: this case is closed, and the
      // only thing left to show is the proof of it.
      if (next.submission) {
        setBundle(next);
        setReceipt(next.submission);
        setStage("done");
        return;
      }

      if (next.questions.length === 0) {
        setUnavailable("unavailable");
        return;
      }

      adopt(next);
    } catch (err) {
      if (!aliveRef.current) return;
      const code = err instanceof FamilyAccessError ? err.code : "unknown";
      setUnavailable(
        code === "no_session" || code === "session_expired"
          ? "session"
          : code === "expired"
            ? "expired"
            : "unavailable",
      );
    }
  }, [adopt]);

  useEffect(() => {
    void load();
  }, [load]);

  const survey = bundle?.survey ?? null;
  /**
   * The local snapshot is keyed by the CASE, not by the survey id on its own.
   * `saveSession` writes `assessment:<id>:v1`, which is the same key space the
   * anonymous runner reads back for a survey — so a bare survey id would leave
   * one bereaved family's in-progress answers exactly where the next reader of
   * that instrument on the same handset would find them. The officer's tablet
   * is a shared device by design, so the key has to name the family.
   */
  const localKey = bundle && survey ? `family:${bundle.case.referenceId}:${survey.id}` : null;
  const questions = useMemo(() => bundle?.questions ?? [], [bundle]);
  const estimatedMinutes = useMemo(() => minutesFromSeconds(estimateSeconds(questions)), [questions]);
  const questionById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  // ── Autosave ────────────────────────────────────────────────────────────
  //
  // Two tiers, and both are load-bearing:
  //
  //  1. LOCAL is synchronous and runs on every single change. It costs nothing,
  //     needs no network, and is what survives a killed tab, a dead battery or
  //     a browser that decided to reclaim memory mid-question.
  //  2. SERVER is debounced and coalesced. It is the only tier that can cross
  //     devices — a family that starts on the officer's tablet and finishes on
  //     their own phone that evening is the normal case here, and localStorage
  //     is per-device by construction.
  //
  // Neither replaces the other: local without server loses the handover, server
  // without local loses the last answer to any abrupt close.

  const draftRef = useRef<RespondentDraft | null>(null);
  const dirtyRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const draft = draftRef.current;
    if (!dirtyRef.current || !draft) return;
    // Read the live value rather than React state: this also runs from a
    // 'pagehide' listener registered once, long after any render.
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    dirtyRef.current = false;
    void saveFamilyDraft(draft).then((ok) => {
      if (!ok) {
        // Stay dirty so the next change — or the next 'online' — retries it.
        dirtyRef.current = true;
        if (aliveRef.current) setSaveState("local");
        return;
      }
      if (aliveRef.current) setSaveState("synced");
    });
  }, []);

  useEffect(() => {
    if (!survey || !localKey || stage === "done") return;

    const draft: RespondentDraft = { answers, meta, index, stage, startedAt: startedAt.current };

    // `consented` is true because consent was taken on paper before this case
    // existed; the local snapshot shares its shape with the public runner,
    // which does ask on screen.
    saveSession(localKey, { ...draft, consented: true });

    draftRef.current = draft;
    dirtyRef.current = true;

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSaveState("local");
      return;
    }

    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      flush();
    }, SERVER_SAVE_MS);
  }, [survey, localKey, answers, meta, index, stage, flush]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      flush();
    }
    function handleOffline() {
      setOnline(false);
      setSaveState((prev) => (prev === null ? prev : "local"));
    }
    // 'pagehide', not 'beforeunload': iOS Safari does not reliably fire the
    // latter, and a phone being locked mid-assessment is the common way this
    // page goes away.
    function handlePageHide() {
      flush();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pagehide", handlePageHide);
      flush();
    };
  }, [flush]);

  // ── Answer metadata ─────────────────────────────────────────────────────

  // Read through a ref rather than a dependency: `answers` changes on every
  // keystroke in a long-text item, and the alternative is rebuilding these
  // callbacks (and re-rendering the question stage) on each one.
  const answersRef = useRef(answers);
  answersRef.current = answers;

  const patchMeta = useCallback((id: string, patch: Partial<AnswerMeta>) => {
    setMeta((prev) => ({ ...prev, [id]: { ...emptyMeta(), ...prev[id], ...patch } }));
  }, []);

  const setAnswer = useCallback(
    (id: string, v: AnswerValue) => {
      const hadAnswer = isAnswered(answersRef.current[id]);
      const question = questionById.get(id);
      setAnswers((prev) => ({ ...prev, [id]: v }));
      setMeta((prev) => {
        const cur = prev[id] ?? emptyMeta();
        return {
          ...prev,
          [id]: {
            ...cur,
            // The glyph the respondent actually saw beside this choice, captured
            // at the moment of choosing rather than re-derived at export time.
            emoji: question ? emojiForAnswer(question, v) : null,
            // Answering something skipped earlier un-skips it. The row now
            // carries a value, and survey_answers_skipped_has_no_value forbids
            // a skipped row with one — a stale `skipped: true` here would be
            // rejected by the database, not quietly ignored.
            skipped: false,
            edited: cur.edited || hadAnswer,
            answeredAt: new Date().toISOString(),
          },
        };
      });
    },
    [questionById],
  );

  const markSkipped = useCallback(
    (id: string) => {
      // Clear the value as well: "skipped" and "answered" are mutually
      // exclusive states of the same row, both here and in the database.
      setAnswers((prev) => {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      patchMeta(id, { skipped: true, emoji: null });
    },
    [patchMeta],
  );

  const markVoice = useCallback((id: string) => patchMeta(id, { voiceUsed: true }), [patchMeta]);

  const addDwell = useCallback(
    (id: string, seconds: number) =>
      setMeta((prev) => {
        const cur = prev[id] ?? emptyMeta();
        // Accumulated, never overwritten: coming back to a question to change
        // an answer is time spent on it too.
        return { ...prev, [id]: { ...cur, seconds: cur.seconds + seconds } };
      }),
    [],
  );

  // ── Submit ──────────────────────────────────────────────────────────────

  const finish = useCallback(
    (result: SubmissionReceipt) => {
      // Nothing may write a draft after this point — the case is closed server
      // side and the local copy is the only thing left that could resurrect it.
      dirtyRef.current = false;
      draftRef.current = null;
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (localKey) clearSession(localKey);
      setReceipt(result);
      setStage("done");
    },
    [localKey],
  );

  async function handleSubmit() {
    if (submitLock.current || !survey) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      const result = await submitFamilyAssessment({
        answers,
        meta,
        language: mode,
        startedAt: startedAt.current,
      });
      finish(result);
    } catch (err) {
      // A double-tap that raced past the lock, or a retry after a response that
      // was written but never reached the browser. The assessment IS submitted;
      // the only thing missing is the receipt, so go and fetch it.
      if (err instanceof FamilyAccessError && err.code === "already_submitted") {
        try {
          const again = await resumeFamilySession();
          if (again.submission) {
            finish(again.submission);
            return;
          }
        } catch {
          /* fall through to the same calm failure as any other error */
        }
      }
      // A family sees a translated sentence, never a backend error string.
      toast.error(t("submitFailed"));
      submitLock.current = false;
    } finally {
      if (aliveRef.current) setSubmitting(false);
    }
  }

  // ── Chrome ──────────────────────────────────────────────────────────────

  async function handleLeave() {
    flush();
    await familySignOut();
    navigate("/family", { replace: true });
  }

  /**
   * Nothing in the header on the thank-you screen. The session token is revoked
   * the moment a submission lands, so "Leave" would offer to sign out of a
   * session that no longer exists, and the save indicator would be reporting on
   * a draft that has been deleted. That stage is terminal by design.
   */
  const headerAction = stage === "done" ? undefined : (
    <div className="flex shrink-0 items-center gap-1">
      {saveState && (
        <span
          className="inline-flex items-center gap-1.5 t-caption text-muted-foreground"
          aria-live="polite"
          title={saveState === "synced" ? t("familySavedToAccount") : t("familySavingOffline")}
        >
          {saveState === "synced" ? (
            <Check className="h-4 w-4 text-success" strokeWidth={2.2} />
          ) : (
            <CloudOff className="h-4 w-4" strokeWidth={1.8} />
          )}
          {/* Whisper-quiet, and the first thing to go when the header is tight —
              it must never compete with the question for attention. */}
          <span className="hidden sm:inline">
            {saveState === "synced" ? t("familySavedToAccount") : t("familySavingOffline")}
          </span>
        </span>
      )}

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" shape="pill" className="gap-1.5 px-2.5 text-muted-foreground sm:px-3.5">
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
            <span className="hidden sm:inline">{t("familyExit")}</span>
            <span className="sr-only sm:hidden">{t("familyExit")}</span>
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="t-section">{t("familyExitTitle")}</AlertDialogTitle>
            <AlertDialogDescription className="t-body leading-relaxed text-muted-foreground">
              {t("familyExitBody")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>{t("familyExitConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  // ── Status screens ──────────────────────────────────────────────────────

  if (unavailable) return <FamilyExpiredStage reason={unavailable} />;

  if (!bundle) {
    /* Not a spinner. The gate should feel like the product is thinking, not
       like a page is buffering — and this is the first thing a family sees
       after entering their PIN. */
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas">
        <motion.div
          initial={{ opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { opacity: [0.35, 1, 0.35] }}
          transition={reduce ? { duration: 0.3 } : { duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <Logo size={52} />
        </motion.div>
        <span className="sr-only">{t("loading")}</span>
      </div>
    );
  }

  // ── Stages ──────────────────────────────────────────────────────────────

  const hasFooter = stage === "questions" || stage === "review";

  let body: JSX.Element;

  if (!survey) {
    // Only reachable if the instrument was withdrawn between load and render.
    body = <FamilyExpiredStage reason="unavailable" />;
  } else if (stage === "done" && receipt) {
    body = <FamilyThankYouStage survey={survey} mode={mode} receipt={receipt} />;
  } else if (questions.length === 0) {
    body = <FamilyExpiredStage reason="unavailable" />;
  } else if (stage === "welcome") {
    body = (
      <FamilyWelcomeStage
        survey={survey}
        mode={mode}
        minutes={estimatedMinutes}
        questionCount={questions.length}
        familyHead={bundle.case.familyHead}
        canResume={canResume}
        onBegin={() => {
          // Begin does NOT wipe. A family that already has answers on the server
          // tapping "Begin" means "take me to the top", not "destroy what I
          // said last week" — and there is no undo for a family, no support
          // desk to call, and no second visit from the officer to redo it.
          setIndex(0);
          if (!canResume) startedAt.current = new Date().toISOString();
          setStage("questions");
        }}
        onResume={() => {
          // Land them on the first question they have not answered rather than
          // wherever they happened to close the phone — after a gap of days the
          // gap is what matters, not the cursor position.
          const next = firstUnansweredIndex(questions, answers);
          setIndex(next === -1 ? Math.min(index, questions.length - 1) : next);
          setStage(next === -1 ? "review" : "questions");
        }}
      />
    );
  } else if (stage === "review") {
    body = (
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
  } else {
    body = (
      <QuestionStage
        questions={questions}
        index={Math.min(index, questions.length - 1)}
        answers={answers}
        meta={meta}
        mode={mode}
        onAnswer={setAnswer}
        onNavigate={setIndex}
        onBackToIntro={() => setStage("welcome")}
        onReview={() => setStage("review")}
        onSkip={markSkipped}
        onDwell={addDwell}
        onVoice={markVoice}
      />
    );
  }

  return (
    <AssessmentChromeProvider identityLine={bundle.case.referenceId} headerAction={headerAction}>
      {body}

      {/* Non-blocking by design. Losing connectivity is not an error a family
          did anything about, and it changes nothing they can see — the local
          tier is still writing every answer. So: one quiet line, stacked above
          the floating help control rather than over the answer column. */}
      <AnimatePresence>
        {!online && stage !== "done" && (
          <motion.div
            key="offline"
            role="status"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.28, ease: EASE }}
            className={cn(
              "fixed inset-x-4 z-40 mx-auto flex max-w-md items-start gap-2.5 rounded-surface border border-border/70",
              "bg-card/95 px-3.5 py-2.5 shadow-float backdrop-blur-xl sm:inset-x-6",
              hasFooter
                ? "bottom-[calc(76px+env(safe-area-inset-bottom)+4.5rem)]"
                : "bottom-[calc(env(safe-area-inset-bottom)+4.75rem)]",
            )}
          >
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" strokeWidth={1.8} />
            <span className="min-w-0 t-caption leading-relaxed text-muted-foreground">{t("familyOfflineNote")}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </AssessmentChromeProvider>
  );
}
