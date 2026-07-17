import { motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";
import type { SurveyQuestion, AnswerValue } from "@/lib/surveys";
import { RatingStars } from "@/components/survey/RatingStars";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BilingualText } from "@/components/BilingualText";
import { chromeLang, renderBilingual, type Lang, type LangMode } from "@/lib/i18n";

const LIKERT_LABELS: Record<Lang, string[]> = {
  en: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  te: ["పూర్తిగా విభేదిస్తా", "విభేదిస్తా", "తటస్థం", "అంగీకరిస్తా", "పూర్తిగా అంగీకరిస్తా"],
};

export function QuestionRenderer({
  question,
  mode,
  value,
  onChange,
  error,
  index,
}: {
  question: SurveyQuestion;
  mode: LangMode;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  error?: string;
  index: number;
}) {
  const lang = chromeLang(mode);
  const t = (en: string, te: string) => (lang === "te" ? te : en);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`group rounded-surface border bg-card p-5 shadow-sm transition-all sm:p-6 ${
        error ? "border-destructive/60 ring-2 ring-destructive/15" : "border-border/70 hover:border-border"
      }`}
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-accent t-caption font-bold tabular-nums text-accent-foreground">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="t-body font-semibold leading-snug text-balance">
            <BilingualText mode={mode} en={question.prompt_en} te={question.prompt_te} secondaryClassName="t-caption" />
            {question.required && <span className="ml-1 align-middle text-destructive">*</span>}
          </div>

          <div className="mt-4">
            {question.kind === "multiple_choice" && (
              <div className="grid gap-2">
                {question.options.map((o) => {
                  const { primary, secondary } = renderBilingual(mode, o.label_en, o.label_te);
                  const selected = value === o.id;
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onChange(o.id)}
                      className={`w-full rounded-surface border p-3.5 text-left transition-all active:scale-[0.99] ${
                        selected
                          ? "border-primary bg-accent ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-pill border-2 transition-colors ${
                            selected ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {selected && <span className="h-2 w-2 rounded-pill bg-primary-foreground" />}
                        </span>
                        <span className="min-w-0">
                          <span className="text-sm font-medium">{primary}</span>
                          {secondary && <span className="block t-caption text-muted-foreground">{secondary}</span>}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "checkboxes" && (
              <div className="grid gap-2">
                {question.options.map((o) => {
                  const { primary, secondary } = renderBilingual(mode, o.label_en, o.label_te);
                  const arr = Array.isArray(value) ? value : [];
                  const selected = arr.includes(o.id);
                  return (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => onChange(selected ? arr.filter((v) => v !== o.id) : [...arr, o.id])}
                      className={`w-full rounded-surface border p-3.5 text-left transition-all active:scale-[0.99] ${
                        selected
                          ? "border-primary bg-accent ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition-colors ${
                            selected ? "border-primary bg-primary" : "border-border"
                          }`}
                        >
                          {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                        </span>
                        <span className="min-w-0">
                          <span className="text-sm font-medium">{primary}</span>
                          {secondary && <span className="block t-caption text-muted-foreground">{secondary}</span>}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "dropdown" && (
              <Select value={typeof value === "string" ? value : undefined} onValueChange={(v) => onChange(v)}>
                <SelectTrigger className="h-12 rounded-surface">
                  <SelectValue placeholder={t("Select an option", "ఎంపికను ఎంచుకోండి")} />
                </SelectTrigger>
                <SelectContent>
                  {question.options.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {renderBilingual(mode, o.label_en, o.label_te).primary}
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
                      className={`rounded-surface border px-1 py-3 text-center transition-all active:scale-[0.97] ${
                        selected ? "border-primary bg-accent ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                      }`}
                    >
                      <span
                        className={`mx-auto grid h-7 w-7 place-items-center rounded-pill t-caption font-bold ${
                          selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {n}
                      </span>
                      <span className="mt-1.5 hidden t-caption leading-tight text-muted-foreground sm:block">{label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {question.kind === "yes_no" && (
              <div className="flex gap-3">
                {(["yes", "no"] as const).map((v) => {
                  const selected = value === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => onChange(v)}
                      className={`flex-1 rounded-surface border py-3.5 text-sm font-semibold transition-all active:scale-[0.98] ${
                        selected ? "border-primary bg-accent text-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                      }`}
                    >
                      {v === "yes" ? t("Yes", "అవును") : t("No", "కాదు")}
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
                className="h-12 rounded-surface"
                placeholder={t("Your answer…", "మీ సమాధానం…")}
              />
            )}

            {question.kind === "long_text" && (
              <Textarea
                value={typeof value === "string" ? value : ""}
                onChange={(e) => onChange(e.target.value)}
                maxLength={2000}
                rows={4}
                className="rounded-surface"
                placeholder={t("Your answer…", "మీ సమాధానం…")}
              />
            )}
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-1.5 t-caption font-medium text-destructive">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
