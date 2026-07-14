import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/LangToggle";
import { QuestionRenderer } from "@/components/survey/QuestionRenderer";
import type { AnswerValue, Survey, SurveyQuestion } from "@/lib/surveys";
import type { Lang } from "@/lib/i18n";

export function SurveyForm({
  survey,
  questions,
  lang,
  onLangChange,
  onSubmit,
  submitting,
  banner,
}: {
  survey: Survey;
  questions: SurveyQuestion[];
  lang: Lang;
  onLangChange: (l: Lang) => void;
  onSubmit: (answers: Record<string, AnswerValue>) => void | Promise<void>;
  submitting: boolean;
  banner?: React.ReactNode;
}) {
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const refs = useRef<Record<string, HTMLDivElement | null>>({});

  const title = lang === "te" && survey.title_te ? survey.title_te : survey.title_en;
  const description = lang === "te" && survey.description_te ? survey.description_te : survey.description_en;

  const answeredCount = useMemo(
    () => questions.filter((q) => {
      const v = answers[q.id];
      return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0);
    }).length,
    [answers, questions],
  );
  const progress = questions.length ? Math.round((answeredCount / questions.length) * 100) : 0;

  function setAnswer(id: string, v: AnswerValue) {
    setAnswers((a) => ({ ...a, [id]: v }));
    if (errors[id]) setErrors((e) => { const n = { ...e }; delete n[id]; return n; });
  }

  function validate(): boolean {
    const nextErrors: Record<string, string> = {};
    for (const q of questions) {
      if (!q.required) continue;
      const v = answers[q.id];
      const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) nextErrors[q.id] = lang === "te" ? "ఈ ప్రశ్నకు సమాధానం అవసరం" : "This question requires an answer";
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
    <div className="min-h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg brand-gradient grid place-items-center shadow-sm shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-muted-foreground truncate">Government of Andhra Pradesh · Department of Police</div>
          </div>
          <LangToggle size="sm" />
        </div>
        {questions.length > 0 && (
          <div className="h-1 bg-muted overflow-hidden">
            <motion.div initial={false} animate={{ width: `${progress}%` }} transition={{ type: "spring", stiffness: 120, damping: 22 }} className="h-full brand-gradient" />
          </div>
        )}
      </header>

      {banner}

      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 py-8 space-y-5">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
            <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-balance">{title}</h1>
            {description && <p className="mt-2 text-sm sm:text-[15px] text-muted-foreground leading-relaxed text-balance">{description}</p>}
            {questions.length > 0 && (
              <div className="mt-3 text-xs text-muted-foreground tabular-nums">{answeredCount} / {questions.length} {lang === "te" ? "సమాధానమిచ్చారు" : "answered"}</div>
            )}
          </motion.div>

          {questions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-10 text-center text-sm text-muted-foreground">
              {lang === "te" ? "ఈ సర్వేలో ఇంకా ప్రశ్నలు లేవు." : "This survey doesn't have any questions yet."}
            </div>
          ) : (
            questions.map((q, i) => (
              <div key={q.id} ref={(el) => (refs.current[q.id] = el)}>
                <QuestionRenderer question={q} lang={lang} value={answers[q.id] ?? null} onChange={(v) => setAnswer(q.id, v)} error={errors[q.id]} index={i} />
              </div>
            ))
          )}
        </div>
      </main>

      {questions.length > 0 && (
        <footer className="sticky bottom-0 border-t border-border/60 bg-white/90 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 py-3">
            <Button onClick={handleSubmit} disabled={submitting} className="w-full rounded-xl h-12 shadow-md">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><Send className="h-4 w-4 mr-1.5" />{lang === "te" ? "సమర్పించండి" : "Submit"}</>)}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}
