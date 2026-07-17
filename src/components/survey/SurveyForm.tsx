import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, Loader2, Send, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/LangToggle";
import { QuestionRenderer } from "@/components/survey/QuestionRenderer";
import { BilingualText } from "@/components/BilingualText";
import type { AnswerValue, Survey, SurveyQuestion } from "@/lib/surveys";
import { useLangMode, chromeLang } from "@/lib/i18n";

export function SurveyForm({
  survey,
  questions,
  onSubmit,
  submitting,
  banner,
}: {
  survey: Survey;
  questions: SurveyQuestion[];
  onSubmit: (answers: Record<string, AnswerValue>) => void | Promise<void>;
  submitting: boolean;
  banner?: React.ReactNode;
}) {
  const mode = useLangMode();
  const lang = chromeLang(mode);
  const t = (en: string, te: string) => (lang === "te" ? te : en);

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const answeredCount = useMemo(
    () =>
      questions.filter((q) => {
        const v = answers[q.id];
        return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
      }).length,
    [answers, questions],
  );
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  function setAnswer(id: string, v: AnswerValue) {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id])
      setErrors((e) => {
        const n = { ...e };
        delete n[id];
        return n;
      });
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) nextErrors[q.id] = t("This question requires an answer", "ఈ ప్రశ్నకు సమాధానం అవసరం");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstId = questions.find((q) => nextErrors[q.id])?.id;
      if (firstId) refs.current[firstId]?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  async function handleSubmit() {
    if (!validate()) return;
    await onSubmit(answers);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-gradient-to-b from-accent/40 to-background">
          <header className="sticky top-0 z-30 border-b border-border/60 bg-card/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3 sm:px-6">
              <div className="brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-control shadow-sm">
                <ShieldCheck className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate t-caption font-semibold">AP Police</div>
                <div className="truncate t-caption text-muted-foreground">
                  {t("Government of Andhra Pradesh", "ఆంధ్రప్రదేశ్ ప్రభుత్వం")}
                </div>
              </div>
              <LangToggle size="sm" />
            </div>
            {questions.length > 0 && (
              <div className="h-1 overflow-hidden bg-muted">
                <motion.div
                  initial={false}
                  animate={{ width: `${progress}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 22 }}
                  className="brand-gradient h-full"
                />
              </div>
            )}
          </header>

          {banner}

          <main className="flex-1">
            <div className="mx-auto max-w-2xl space-y-4 px-4 py-8 sm:px-6">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-surface border border-border/70 bg-card p-6 shadow-sm sm:p-7"
              >
                <BilingualText
                  as="h1"
                  mode={mode}
                  en={survey.title_en}
                  te={survey.title_te}
                  className="t-hero tracking-tight text-balance"
                  secondaryClassName="t-body sm:text-lg font-medium"
                />
                {(survey.description_en || survey.description_te) && (
                  <BilingualText
                    as="p"
                    mode={mode}
                    en={survey.description_en ?? ""}
                    te={survey.description_te}
                    className="mt-4 t-body leading-relaxed text-muted-foreground text-balance"
                  />
                )}
                {questions.length > 0 && (
                  <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4 t-caption text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    <span>{t("Confidential · no login required", "గోప్యం · లాగిన్ అవసరం లేదు")}</span>
                    <span className="ml-auto tabular-nums font-medium text-foreground">
                      {answeredCount} / {questions.length} {t("answered", "సమాధానమిచ్చారు")}
                    </span>
                  </div>
                )}
              </motion.div>

              {questions.length === 0 ? (
                <div className="rounded-surface border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
                  {t("This survey doesn't have any questions yet.", "ఈ సర్వేలో ఇంకా ప్రశ్నలు లేవు.")}
                </div>
              ) : (
                questions.map((q, i) => (
                  <div key={q.id} ref={(el) => (refs.current[q.id] = el)}>
                    <QuestionRenderer question={q} mode={mode} value={answers[q.id] ?? null} onChange={(v) => setAnswer(q.id, v)} error={errors[q.id]} index={i} />
                  </div>
                ))
              )}
            </div>
          </main>

          {questions.length > 0 && (
            <footer className="sticky bottom-0 border-t border-border/60 bg-card/90 backdrop-blur-xl">
              <div className="mx-auto max-w-2xl px-4 py-3 sm:px-6">
                <Button onClick={handleSubmit} disabled={submitting} className="h-12 w-full rounded-surface text-base shadow-md">
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="mr-1.5 h-4 w-4" />
                      {t("Submit", "సమర్పించండి")}
                    </>
                  )}
                </Button>
              </div>
            </footer>
          )}
        </div>
  );
}
