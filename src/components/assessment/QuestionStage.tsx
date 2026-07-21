import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell, AssessmentFooter } from "@/components/assessment/AssessmentShell";
import { AnswerCards } from "@/components/assessment/AnswerCards";
import { VoiceControl } from "@/components/assessment/VoiceControl";
import { renderBilingual, useT, chromeLang, type LangMode } from "@/lib/i18n";
import { isAnswered, minutesFromSeconds, remainingSeconds, type AnswerMeta } from "@/lib/assessmentSession";
import type { AnswerValue, SurveyQuestion } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const EASE = [0.33, 1, 0.68, 1] as const;

/**
 * How long a tapped answer is allowed to sit and be seen before the screen
 * moves on. Matches --dur-slow: long enough that the selection registers as
 * confirmed, short enough that it never feels like the app is thinking.
 */
const SELECTION_SETTLE_MS = 380;

/** The full-sentence anchors, spoken after the prompt so listeners hear their choices. */
const LIKERT_SPOKEN: Record<"en" | "te", string[]> = {
  en: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  te: ["పూర్తిగా విభేదిస్తా", "విభేదిస్తా", "తటస్థం", "అంగీకరిస్తా", "పూర్తిగా అంగీకరిస్తా"],
};

/**
 * What the Listen button reads: the prompt, then the options. Someone using
 * narration because they cannot read the screen needs the choices too — the
 * question alone would leave them with nothing to answer.
 */
function narrationText(question: SurveyQuestion, mode: LangMode, t: ReturnType<typeof useT>): string {
  const lang = chromeLang(mode);
  const prompt = renderBilingual(mode, question.prompt_en, question.prompt_te).primary;
  const parts: string[] = [prompt];

  if (question.kind === "likert5") {
    parts.push(...LIKERT_SPOKEN[lang]);
  } else if (question.kind === "yes_no") {
    parts.push(t("yes"), t("no"));
  } else if (question.kind === "multiple_choice" || question.kind === "dropdown" || question.kind === "checkboxes") {
    parts.push(...question.options.map((o) => renderBilingual(mode, o.label_en, o.label_te).primary));
  }

  // Full stops give the engine its sentence breaks, which is also where
  // chunkText splits — so each option lands as its own utterance.
  return parts.map((p) => (/[.!?।]$/.test(p.trim()) ? p.trim() : `${p.trim()}.`)).join(" ");
}

export function QuestionStage({
  questions,
  index,
  answers,
  meta,
  mode,
  onAnswer,
  onNavigate,
  onBackToIntro,
  onReview,
  onSkip,
  onDwell,
  onVoice,
}: {
  questions: SurveyQuestion[];
  index: number;
  answers: Record<string, AnswerValue>;
  meta: Record<string, AnswerMeta>;
  mode: LangMode;
  onAnswer: (id: string, v: AnswerValue) => void;
  onNavigate: (nextIndex: number) => void;
  onBackToIntro: () => void;
  onReview: () => void;
  /** Explicitly moved past without answering. */
  onSkip: (id: string) => void;
  /** Seconds this question was on screen, reported when leaving it. */
  onDwell: (id: string, seconds: number) => void;
  onVoice: (id: string) => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const question = questions[index];
  const total = questions.length;
  const value = answers[question.id] ?? null;
  const answered = isAnswered(value);
  const wasSkipped = !!meta[question.id]?.skipped && !answered;

  /** +1 forward, -1 back — drives which side the new question slides in from. */
  const [direction, setDirection] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** The pending tap-to-advance timer, so any manual navigation can cancel it. */
  const commitTimer = useRef<number | null>(null);

  function clearCommit() {
    if (commitTimer.current !== null) {
      window.clearTimeout(commitTimer.current);
      commitTimer.current = null;
    }
  }
  // Never let a scheduled auto-advance fire after the stage unmounts.
  useEffect(() => () => clearCommit(), []);

  /**
   * Time on this question, accumulated. The clock is per-question-id and flushes
   * on the way out (including on unmount, which is how the last question's dwell
   * reaches the review stage). Wall-clock rather than an interval: a respondent
   * who backgrounds the tab mid-question should not have that counted as
   * thinking time, so it is capped when reported.
   */
  const enteredAt = useRef<number>(Date.now());
  const dwellRef = useRef(onDwell);
  dwellRef.current = onDwell;

  useEffect(() => {
    const id = question.id;
    enteredAt.current = Date.now();
    return () => {
      const seconds = Math.round((Date.now() - enteredAt.current) / 1000);
      // 15 minutes on one item means the phone was put down, not that the
      // question took that long to consider.
      if (seconds > 0) dwellRef.current(id, Math.min(seconds, 900));
    };
  }, [question.id]);

  /**
   * Move focus to the new question. Without this the screen changes but a
   * keyboard or screen-reader user is left focused on the Next button of a
   * question that no longer exists, and hears nothing about the new one.
   */
  useEffect(() => {
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [question.id]);

  const minutesLeft = useMemo(
    () => minutesFromSeconds(remainingSeconds(questions, answers, index)),
    [questions, answers, index],
  );
  const secondsLeft = useMemo(() => remainingSeconds(questions, answers, index), [questions, answers, index]);

  const advance = useCallback(() => {
    setDirection(1);
    if (index >= total - 1) onReview();
    else onNavigate(index + 1);
  }, [index, total, onNavigate, onReview]);

  /**
   * Nothing blocks. A required question that has not been answered is recorded
   * as unanswered and surfaced again on the review screen, where the respondent
   * can choose to fill it in or submit as-is. Refusing to advance would trap
   * someone on an item they may have a real reason not to answer — on a
   * well-being instrument that is how a whole session gets abandoned.
   */
  const goNext = useCallback(() => {
    clearCommit();
    advance();
  }, [advance]);

  const goPrev = useCallback(() => {
    clearCommit();
    setDirection(-1);
    if (index === 0) onBackToIntro();
    else onNavigate(index - 1);
  }, [index, onNavigate, onBackToIntro]);

  const skip = useCallback(() => {
    clearCommit();
    onSkip(question.id);
    advance();
  }, [advance, onSkip, question.id]);

  // Arrow keys page through the assessment — but ONLY when focus is on the page
  // itself, never when it sits on an interactive control. Otherwise an arrow
  // press meant to move between answer options (role="radio") or nudge a
  // Previous/Next button would silently jump to another question instead.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && el.closest('input, textarea, select, button, a, [role="radio"], [role="checkbox"], [contenteditable="true"]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  const prompt = renderBilingual(mode, question.prompt_en, question.prompt_te).primary;
  const percent = total ? (index / total) * 100 : 0;

  const remainingLabel =
    secondsLeft < 60
      ? t("lessThanMinuteRemaining")
      : minutesLeft === 1
        ? t("aboutOneMinuteRemaining")
        : t("aboutMinutesRemaining", { n: minutesLeft });

  const progress = (
    <div className="mx-auto w-full max-w-3xl px-5 pb-3 sm:px-6">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-caption font-semibold tabular-nums text-foreground">
          {t("questionXofY", { i: index + 1, n: total })}
        </span>
        <span className="t-caption text-muted-foreground">{remainingLabel}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-pill bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={index + 1}
        aria-label={t("questionXofY", { i: index + 1, n: total })}
      >
        <motion.div
          initial={false}
          animate={{ scaleX: percent / 100 }}
          transition={{ type: "spring", stiffness: 140, damping: 24 }}
          className="brand-gradient h-full w-full origin-left rounded-pill"
        />
      </div>
    </div>
  );

  const footer = (
    <AssessmentFooter>
      <div className="flex items-center gap-2 sm:gap-3">
        <Button
          onClick={goPrev}
          variant="ghost"
          size="lg"
          shape="pill"
          className="gap-2 px-3.5 text-muted-foreground sm:px-5"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          <span className="hidden sm:inline">{t("previous")}</span>
        </Button>

        {/* Skip is a peer of Next, not a hidden link. Making it visible is what
            lets "you may leave anything blank" be true in practice rather than
            just stated on the instructions screen. */}
        {!answered && (
          <Button
            onClick={skip}
            variant="ghost"
            size="lg"
            shape="pill"
            aria-label={t("skipQuestion")}
            className="min-w-0 gap-2 px-3.5 text-muted-foreground sm:px-4"
          >
            <SkipForward className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {/* Label only from 375px. At 320 the row is Previous + Skip + Next,
                and "ప్రస్తుతానికి దాటవేయండి" is three times the English width —
                keeping it would push Next off the screen. */}
            <span className="hidden min-w-0 truncate xs:inline">{t("skipQuestion")}</span>
          </Button>
        )}

        {answered && (
          <span className="hidden items-center gap-1.5 t-caption text-success sm:inline-flex" aria-live="polite">
            <Check className="h-4 w-4" strokeWidth={2.4} />
            {t("saved")}
          </span>
        )}

        <Button onClick={goNext} size="lg" shape="pill" className="ml-auto min-w-[112px] gap-2 px-5 sm:min-w-[132px] sm:px-6">
          {index >= total - 1 ? t("goToReview") : t("next")}
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
        </Button>
      </div>
    </AssessmentFooter>
  );

  return (
    <AssessmentShell progress={progress} footer={footer}>
      {/*
        Keyed remount instead of AnimatePresence. `mode="wait"` would hold the
        incoming question back until the outgoing one finished animating out,
        which is exactly the lag this redesign is meant to remove. Remounting on
        the id swaps the DOM immediately and the entry animation rides on top.
      */}
      <motion.div
        key={question.id}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.24, ease: EASE }}
      >
        <h1 ref={headingRef} tabIndex={-1} className="t-question text-balance outline-none">
          {prompt}
        </h1>

        <div className="mt-5">
          <VoiceControl
            text={narrationText(question, mode, t)}
            resetKey={question.id}
            onSpoken={() => onVoice(question.id)}
          />
        </div>

        <div className="mt-7">
          <AnswerCards
            question={question}
            mode={mode}
            value={value}
            onChange={(v) => onAnswer(question.id, v)}
            onCommit={() => {
              // Give the selection a beat to register visually, then move on.
              // Only fires on a first answer, never on a correction. Held in a
              // ref so a manual Prev/Next within the window cancels it.
              clearCommit();
              if (reduce) {
                advance();
                return;
              }
              commitTimer.current = window.setTimeout(() => {
                commitTimer.current = null;
                advance();
              }, SELECTION_SETTLE_MS);
            }}
          />
        </div>

        {wasSkipped && (
          <p className={cn("mt-4 flex items-center gap-2 t-caption text-muted-foreground")}>
            <SkipForward className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {t("skippedNote")}
          </p>
        )}
      </motion.div>
    </AssessmentShell>
  );
}
