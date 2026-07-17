import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Loader2, Pencil, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell, AssessmentFooter } from "@/components/assessment/AssessmentShell";
import { describeAnswer } from "@/components/assessment/AnswerCards";
import { renderBilingual, useT, type LangMode } from "@/lib/i18n";
import { countAnswered, isAnswered } from "@/lib/assessmentSession";
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
  const remaining = questions.length - answeredCount;

  // Only unanswered REQUIRED items block submission; an optional question left
  // blank is a valid answer in itself.
  const missingRequired = useMemo(
    () => questions.filter((q) => q.required && !isAnswered(answers[q.id])),
    [questions, answers],
  );
  const firstMissingIndex = missingRequired.length ? questions.findIndex((q) => q.id === missingRequired[0].id) : -1;

  const footer = (
    <AssessmentFooter>
      <div className="flex items-center gap-3">
        <Button onClick={onBack} variant="ghost" className="h-[52px] gap-2 rounded-pill px-4 text-base text-muted-foreground sm:px-5">
          <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {t("back")}
        </Button>
        <Button
          onClick={missingRequired.length ? () => onEdit(firstMissingIndex) : onSubmit}
          disabled={submitting}
          className="ml-auto h-[52px] flex-1 gap-2 rounded-pill text-base sm:flex-none sm:min-w-[200px]"
        >
          {submitting ? (
            <>
              <Loader2 className="h-[18px] w-[18px] animate-spin" />
              {t("submitting")}
            </>
          ) : missingRequired.length ? (
            <>
              <Pencil className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {t("answerRemainingNote", { n: missingRequired.length })}
            </>
          ) : (
            <>
              <Send className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {t("submitAnswers")}
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

        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-surface border border-border/70 bg-card p-4">
            <div className="eyebrow">{t("answeredCount")}</div>
            <div className="mt-1 t-title tabular-nums text-success">
              {answeredCount}
              <span className="t-body text-muted-foreground"> / {questions.length}</span>
            </div>
          </div>
          <div className="rounded-surface border border-border/70 bg-card p-4">
            <div className="eyebrow">{t("remainingCount")}</div>
            <div className={cn("mt-1 t-title tabular-nums", remaining ? "text-warning" : "text-muted-foreground")}>
              {remaining}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "mt-3 flex items-center gap-2.5 rounded-surface border p-3.5 t-body",
            missingRequired.length ? "border-warning/30 bg-warning/10" : "border-success/25 bg-success/10",
          )}
        >
          {missingRequired.length ? (
            <>
              <AlertCircle className="h-[18px] w-[18px] shrink-0 text-warning" strokeWidth={1.8} />
              <span>{t("answerRemainingNote", { n: missingRequired.length })}</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-success" strokeWidth={1.8} />
              <span>{t("allAnswered")}</span>
            </>
          )}
        </div>

        <ul className="mt-6 grid gap-2">
          {questions.map((q, i) => {
            const prompt = renderBilingual(mode, q.prompt_en, q.prompt_te).primary;
            const answer = describeAnswer(q, answers[q.id] ?? null, mode);
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
                    answer ? "border-border/70 hover:border-primary/40" : "border-warning/40 hover:border-warning",
                  )}
                >
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-muted t-caption font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block t-body font-medium leading-snug">{prompt}</span>
                    <span
                      className={cn(
                        "mt-1.5 block t-body",
                        answer ? "font-semibold text-primary" : "font-medium text-warning",
                      )}
                    >
                      {answer ?? t("notAnswered")}
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
