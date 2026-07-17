import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, AlertCircle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell, AssessmentFooter } from "@/components/assessment/AssessmentShell";
import { AnswerCards } from "@/components/assessment/AnswerCards";
import { VoiceControl } from "@/components/assessment/VoiceControl";
import { renderBilingual, useT, chromeLang, type LangMode } from "@/lib/i18n";
import { isAnswered, minutesFromSeconds, remainingSeconds } from "@/lib/assessmentSession";
import type { AnswerValue, SurveyQuestion } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const EASE = [0.33, 1, 0.68, 1] as const;

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
  mode,
  onAnswer,
  onNavigate,
  onBackToIntro,
  onReview,
}: {
  questions: SurveyQuestion[];
  index: number;
  answers: Record<string, AnswerValue>;
  mode: LangMode;
  onAnswer: (id: string, v: AnswerValue) => void;
  onNavigate: (nextIndex: number) => void;
  onBackToIntro: () => void;
  onReview: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const question = questions[index];
  const total = questions.length;
  const value = answers[question.id] ?? null;
  const answered = isAnswered(value);

  const [error, setError] = useState(false);
  /** +1 forward, -1 back — drives which side the new question slides in from. */
  const [direction, setDirection] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const minutesLeft = useMemo(
    () => minutesFromSeconds(remainingSeconds(questions, answers, index)),
    [questions, answers, index],
  );
  const secondsLeft = useMemo(() => remainingSeconds(questions, answers, index), [questions, answers, index]);

  // Clear a stale "please answer" the moment an answer arrives.
  useEffect(() => {
    if (answered) setError(false);
  }, [answered]);

  /**
   * Move focus to the new question. Without this the screen changes but a
   * keyboard or screen-reader user is left focused on the Next button of a
   * question that no longer exists, and hears nothing about the new one.
   */
  useEffect(() => {
    setError(false);
    window.scrollTo(0, 0);
    headingRef.current?.focus({ preventScroll: true });
  }, [question.id]);

  function goNext() {
    if (question.required && !answered) {
      setError(true);
      return;
    }
    setDirection(1);
    if (index >= total - 1) onReview();
    else onNavigate(index + 1);
  }

  function goPrev() {
    setDirection(-1);
    if (index === 0) onBackToIntro();
    else onNavigate(index - 1);
  }

  // Arrow keys page through the assessment, digits pick an option. Both are
  // suppressed while typing so a long-text answer isn't hijacked mid-word.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
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
  });

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
          animate={{ width: `${percent}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 24 }}
          className="brand-gradient h-full rounded-pill"
        />
      </div>
    </div>
  );

  const footer = (
    <AssessmentFooter>
      <div className="flex items-center gap-3">
        <Button
          onClick={goPrev}
          variant="ghost"
          className="h-[52px] gap-2 rounded-pill px-4 text-base text-muted-foreground sm:px-5"
        >
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {t("previous")}
        </Button>

        {answered && (
          <span className="hidden items-center gap-1.5 t-caption text-success sm:inline-flex" aria-live="polite">
            <Check className="h-4 w-4" strokeWidth={2.4} />
            {t("saved")}
          </span>
        )}

        <Button onClick={goNext} className="ml-auto h-[52px] min-w-[132px] gap-2 rounded-pill px-6 text-base">
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
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="t-question text-balance outline-none"
        >
          {prompt}
        </h1>

        <div className="mt-5">
          <VoiceControl text={narrationText(question, mode, t)} resetKey={question.id} />
        </div>

        <div className="mt-7">
          <AnswerCards
            question={question}
            mode={mode}
            value={value}
            onChange={(v) => onAnswer(question.id, v)}
            onCommit={() => {
              // Give the selection a beat to register visually, then move on.
              // Only fires on a first answer, never on a correction.
              window.setTimeout(() => {
                setDirection(1);
                if (index >= total - 1) onReview();
                else onNavigate(index + 1);
              }, 420);
            }}
          />
        </div>

        {error && (
          <p role="alert" className={cn("mt-4 flex items-center gap-2 t-body font-medium text-destructive")}>
            <AlertCircle className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
            {t("requiredAnswer")}
          </p>
        )}
      </motion.div>
    </AssessmentShell>
  );
}
