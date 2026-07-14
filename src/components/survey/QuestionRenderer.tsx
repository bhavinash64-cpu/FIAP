import { motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";
import type { SurveyQuestion } from "@/lib/surveys";
import type { AnswerValue } from "@/lib/surveys";
import { RatingStars } from "@/components/survey/RatingStars";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Lang } from "@/lib/i18n";

const LIKERT_LABELS: Record<Lang, string[]> = {
  en: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  te: ["పూర్తిగా విభేదిస్తున్నాను", "విభేదిస్తున్నాను", "తటస్థం", "అంగీకరిస్తున్నాను", "పూర్తిగా అంగీకరిస్తున్నాను"],
};

export function QuestionRenderer({
  question,
  lang,
  value,
  onChange,
  error,
  index,
}: {
  question: SurveyQuestion;
  lang: Lang;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  error?: string;
  index: number;
}) {
  const prompt = lang === "te" && question.prompt_te ? question.prompt_te : question.prompt_en;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35 }}
      className={`rounded-2xl border bg-card p-5 sm:p-6 transition-colors ${error ? "border-destructive/50" : "border-border/70"}`}
    >
      <div className="flex items-start gap-2">
        <span className="text-xs font-mono text-muted-foreground mt-1 shrink-0">{index + 1}.</span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] sm:text-base font-medium leading-snug text-balance">
            {prompt}
            {question.required && <span className="text-destructive ml-1">*</span>}
          </div>

          <div className="mt-4">
            {question.kind === "multiple_choice" && (
              <div className="space-y-2">
                {question.options.map((o) => {
                  const label = lang === "te" && o.label_te ? o.label_te : o.label_en;
                  const selected = value === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onChange(o.id)}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                        selected ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded-full border-2 grid place-items-center shrink-0 ${selected ? "border-primary bg-primary" : "border-border"}`}>
                          {selected && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
                        </div>
                        <span className="text-sm">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "checkboxes" && (
              <div className="space-y-2">
                {question.options.map((o) => {
                  const label = lang === "te" && o.label_te ? o.label_te : o.label_en;
                  const arr = Array.isArray(value) ? value : [];
                  const selected = arr.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onChange(selected ? arr.filter((v) => v !== o.id) : [...arr, o.id])}
                      className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                        selected ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded-md border-2 grid place-items-center shrink-0 ${selected ? "border-primary bg-primary" : "border-border"}`}>
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </div>
                        <span className="text-sm">{label}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "dropdown" && (
              <Select value={typeof value === "string" ? value : undefined} onValueChange={(v) => onChange(v)}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder={lang === "te" ? "ఎంచుకోండి" : "Select an option"} />
                </SelectTrigger>
                <SelectContent>
                  {question.options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {lang === "te" && o.label_te ? o.label_te : o.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {question.kind === "likert5" && (
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {LIKERT_LABELS[lang].map((label, i) => {
                  const n = i + 1;
                  const selected = value === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => onChange(n)}
                      className={`rounded-xl border py-3 px-1 text-center transition-colors ${
                        selected ? "border-primary bg-accent ring-1 ring-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <div className={`mx-auto h-6 w-6 rounded-full grid place-items-center text-xs font-semibold ${selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{n}</div>
                      <div className="mt-1.5 text-[10px] leading-tight text-muted-foreground hidden sm:block">{label}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "yes_no" && (
              <div className="flex gap-3">
                {(["yes", "no"] as const).map((v) => {
                  const label = v === "yes" ? (lang === "te" ? "అవును" : "Yes") : lang === "te" ? "కాదు" : "No";
                  const selected = value === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onChange(v)}
                      className={`flex-1 rounded-xl border py-3 text-sm font-medium transition-colors ${
                        selected ? "border-primary bg-accent ring-1 ring-primary text-primary" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "rating5" && (
              <RatingStars value={typeof value === "number" ? value : null} onChange={(n) => onChange(n)} />
            )}

            {question.kind === "short_text" && (
              <Input
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                maxLength={300}
                className="h-11 rounded-xl"
                placeholder={lang === "te" ? "మీ సమాధానం…" : "Your answer…"}
              />
            )}

            {question.kind === "long_text" && (
              <Textarea
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                maxLength={2000}
                rows={4}
                className="rounded-xl"
                placeholder={lang === "te" ? "మీ సమాధానం…" : "Your answer…"}
              />
            )}
          </div>

          {error && (
            <div className="mt-2.5 flex items-center gap-1.5 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
