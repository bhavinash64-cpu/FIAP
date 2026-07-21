import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, Pencil, Send, CheckCircle2, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell, AssessmentFooter } from "@/components/assessment/AssessmentShell";
import { describeAnswer } from "@/components/assessment/AnswerCards";
import { emojiForAnswer } from "@/lib/answerVisuals";
import { renderBilingual, useT, type LangMode } from "@/lib/i18n";
import { completionRatio, countAnswered, unansweredQuestions } from "@/lib/assessmentSession";
import type { AnswerValue, SurveyQuestion } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const EASE = [0.33, 1, 0.68, 1] as const;

export function ReviewStage({
  questions,
  answers,
  mode,
  submitting,
  onEdit,
  onBack,
  onSubmit,
}: {
  questions: SurveyQuestion[];
  answers: Record<string, AnswerValue>;
  mode: LangMode;
  submitting: boolean;
  onEdit: (index: number) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const t = useT();
  const reduce = useReducedMotion();

  const answeredCount = useMemo(() => countAnswered(questions, answers), [questions, answers]);
  const missing = useMemo(() => unansweredQuestions(questions, answers), [questions, answers]);
  const percent = Math.round(completionRatio(questions, answers) * 100);

  /**
   * Submit is always available. Required-ness is a research preference about
   * which items matter, not permission the respondent has to earn — so an
   * unanswered item is reported back plainly and then got out of the way of.
   * The pair of actions on the gap card is the whole point: answer now, or
   * submit anyway, both one tap, neither hidden.
   */
  const footer = (
    <AssessmentFooter>
      <div className="flex items-center gap-3">
        <Button onClick={onBack} variant="ghost" size="lg" shape="pill" className="gap-2 px-4 text-muted-foreground sm:px-5">
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {t("back")}
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          size="lg"
          shape="pill"
          className="ml-auto flex-1 gap-2 sm:min-w-[200px] sm:flex-none"
        >
          {submitting ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
              {t("submitting")}
            </>
          ) : (
            <>
              <Send className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {missing.length ? t("submitAnyway") : t("submitAnswers")}
            </>
          )}
        </Button>
      </div>
    </AssessmentFooter>
  );

  return (
    <AssessmentShell center={false} footer={footer}>
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <h1 className="t-title text-balance">{t("reviewTitle")}</h1>
        <p className="mt-2 t-body text-muted-foreground">{t("reviewIntro")}</p>

        {/* Completion as one bar rather than two counters facing off. A
            "Remaining: 4" tile next to "Answered: 10" reads as a deficit to
            clear; a filled bar reads as progress made. */}
        <div className="mt-6 rounded-surface border border-border/70 bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-caption font-semibold text-foreground">{t("completionLabel")}</span>
            <span className="t-caption tabular-nums text-muted-foreground">
              {answeredCount} / {questions.length}
            </span>
          </div>
          <div
            className="mt-2.5 h-2.5 overflow-hidden rounded-pill bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <motion.div
              initial={reduce ? false : { scaleX: 0 }}
              animate={{ scaleX: percent / 100 }}
              transition={{ type: "spring", stiffness: 120, damping: 22, delay: 0.1 }}
              className={cn("h-full w-full origin-left rounded-pill", missing.length ? "bg-primary" : "bg-success")}
            />
          </div>
        </div>

        {missing.length ? (
          <div className="mt-3 rounded-surface border border-border/70 bg-card p-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-accent-tint">
                <ListChecks className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <div className="t-card">{t("unansweredTitle")}</div>
                <p className="mt-0.5 t-caption text-muted-foreground">{t("unansweredBody")}</p>
              </div>
            </div>

            <ul className="mt-3.5 grid gap-1.5">
              {missing.map(({ question, index }) => (
                <li key={question.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(index)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-field border border-border/70 bg-canvas px-3 py-2.5 text-left",
                      "transition-colors duration-fast hover:border-primary/40 hover:bg-muted/50",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    )}
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate t-caption font-medium">
                      {renderBilingual(mode, question.prompt_en, question.prompt_te).primary}
                    </span>
                    <span className="shrink-0 t-caption font-semibold text-primary">{t("answerNow")}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-2.5 rounded-surface border border-success/25 bg-success/10 p-3.5 t-body">
            <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-success" strokeWidth={1.8} />
            <span>{t("allAnswered")}</span>
          </div>
        )}

        <ul className="mt-6 grid gap-2">
          {questions.map((q, i) => {
            const prompt = renderBilingual(mode, q.prompt_en, q.prompt_te).primary;
            const value = answers[q.id] ?? null;
            const answer = describeAnswer(q, value, mode);
            const emoji = emojiForAnswer(q, value);
            return (
              <li key={q.id}>
                {/*
                  The whole row is the edit affordance. A separate pencil button
                  would be a 40px target next to a 500px inert one, and the row
                  is what the respondent is already looking at.
                */}
                <button
                  type="button"
                  onClick={() => onEdit(i)}
                  className={cn(
                    "flex w-full items-start gap-3.5 rounded-surface border bg-card p-4 text-left transition-colors duration-fast",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    answer ? "border-border/70 hover:border-primary/40" : "border-dashed border-border hover:border-primary/40",
                  )}
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-muted t-caption font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block t-body font-medium leading-snug">{prompt}</span>
                    <span className="mt-1.5 flex items-center gap-2">
                      {emoji && (
                        <span aria-hidden className="text-[18px] leading-none">
                          {emoji}
                        </span>
                      )}
                      <span className={cn("t-body", answer ? "font-semibold text-primary" : "font-medium text-muted-foreground")}>
                        {answer ?? t("notAnswered")}
                      </span>
                    </span>
                  </span>
                  <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden />
                  <span className="sr-only">{t("edit")}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </motion.div>
    </AssessmentShell>
  );
}
