import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RatingStars } from "@/components/survey/RatingStars";
import { ScaleMeter } from "@/components/assessment/ScaleMeter";
import { visualsForQuestion, type OptionVisual } from "@/lib/answerVisuals";
import { renderBilingual, useT, type LangMode, chromeLang, type Lang } from "@/lib/i18n";
import type { AnswerValue, SurveyQuestion } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const LIKERT_LABELS: Record<Lang, string[]> = {
  en: ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"],
  te: ["పూర్తిగా విభేదిస్తా", "విభేదిస్తా", "తటస్థం", "అంగీకరిస్తా", "పూర్తిగా అంగీకరిస్తా"],
};

/**
 * One selectable answer. Sized for a thumb and for older eyes: 68px minimum,
 * 17px label, and a hit area that spans the full card rather than a 20px radio.
 *
 * Selection is confirmed three ways at once, because on a phone in daylight one
 * signal is easy to miss: the card takes the brand border and a soft primary
 * glow, the tick fills, and the emoji gives a single spring-scaled beat. The
 * emoji settles slightly larger than at rest and keeps a faint drop-shadow, so
 * the choice still reads as chosen after the animation has finished.
 */
function OptionCard({
  label,
  visual,
  selected,
  onSelect,
  multi = false,
}: {
  label: string;
  visual?: OptionVisual;
  selected: boolean;
  onSelect: () => void;
  multi?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      role={multi ? "checkbox" : "radio"}
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-[68px] w-full items-center gap-4 rounded-surface border-2 px-4 py-3.5 text-left",
        "transition-[background-color,border-color,box-shadow,transform] duration-base ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "active:scale-[0.99]",
        selected
          ? "border-primary bg-accent shadow-[0_0_0_4px_hsl(var(--primary)/0.10),0_6px_20px_-10px_hsl(var(--primary)/0.55)]"
          : "border-border bg-card hover:-translate-y-px hover:border-primary/45 hover:bg-muted/40 hover:shadow-sm",
      )}
    >
      {visual?.emoji ? (
        <motion.span
          aria-hidden
          className="shrink-0 text-[26px] leading-none"
          initial={false}
          animate={
            reduce
              ? { opacity: selected ? 1 : 0.75 }
              : {
                  scale: selected ? 1.16 : 1,
                  opacity: selected ? 1 : 0.72,
                  filter: selected
                    ? "saturate(1.15) drop-shadow(0 2px 8px hsl(var(--primary) / 0.45))"
                    : "saturate(0.85) drop-shadow(0 0 0 transparent)",
                }
          }
          transition={{ type: "spring", stiffness: 460, damping: 15 }}
        >
          {visual.emoji}
        </motion.span>
      ) : visual?.level && visual.total ? (
        <span className="shrink-0">
          <ScaleMeter level={visual.level} total={visual.total} active={selected} />
        </span>
      ) : null}

      <span className={cn("min-w-0 flex-1 text-[17px] leading-snug", selected ? "font-semibold text-foreground" : "font-medium")}>
        {label}
      </span>

      <span
        aria-hidden
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center border-2 transition-colors duration-fast",
          multi ? "rounded-md" : "rounded-pill",
          selected ? "border-primary bg-primary" : "border-border",
        )}
      >
        {selected && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
      </span>
    </button>
  );
}

/**
 * The answer surface for one question.
 *
 * `onCommit` fires only when a question goes from unanswered to answered by a
 * single tap. The question screen uses it to move on by itself, which halves
 * the taps across a 154-item instrument. Changing an answer you already gave
 * never triggers it — a correction must not fling the screen forward.
 *
 * Scoring is untouched: multiple choice still stores the option id, likert5
 * still stores 1–5 in the instrument's own order.
 */
export function AnswerCards({
  question,
  mode,
  value,
  onChange,
  onCommit,
}: {
  question: SurveyQuestion;
  mode: LangMode;
  value: AnswerValue;
  onChange: (v: AnswerValue) => void;
  onCommit?: () => void;
}) {
  const t = useT();
  const lang = chromeLang(mode);
  const { visuals } = visualsForQuestion(question);
  const wasEmpty = value === null || value === undefined || value === "";

  const commitIfNew = () => {
    if (wasEmpty) onCommit?.();
  };

  // A dropdown collapses five anchors behind a tap and a scroll. On this screen
  // the options have room to simply be visible, so it renders as cards like any
  // other single choice — the stored value is the same option id either way.
  if (question.kind === "multiple_choice" || question.kind === "dropdown") {
    return (
      <div role="radiogroup" aria-label={renderBilingual(mode, question.prompt_en, question.prompt_te).primary} className="grid gap-2.5">
        {question.options.map((o, i) => (
          <OptionCard
            key={o.id}
            label={renderBilingual(mode, o.label_en, o.label_te).primary}
            visual={visuals[i]}
            selected={value === o.id}
            onSelect={() => {
              onChange(o.id);
              commitIfNew();
            }}
          />
        ))}
      </div>
    );
  }

  if (question.kind === "likert5") {
    return (
      <div role="radiogroup" aria-label={renderBilingual(mode, question.prompt_en, question.prompt_te).primary} className="grid gap-2.5">
        {LIKERT_LABELS[lang].map((label, i) => {
          const n = i + 1;
          return (
            <OptionCard
              key={n}
              label={label}
              visual={visuals[i]}
              selected={value === n}
              onSelect={() => {
                onChange(n);
                commitIfNew();
              }}
            />
          );
        })}
      </div>
    );
  }

  if (question.kind === "yes_no") {
    return (
      <div role="radiogroup" aria-label={renderBilingual(mode, question.prompt_en, question.prompt_te).primary} className="grid gap-2.5">
        {(["yes", "no"] as const).map((v) => (
          <OptionCard
            key={v}
            label={v === "yes" ? t("yes") : t("no")}
            selected={value === v}
            onSelect={() => {
              onChange(v);
              commitIfNew();
            }}
          />
        ))}
      </div>
    );
  }

  if (question.kind === "checkboxes") {
    const arr = Array.isArray(value) ? value : [];
    return (
      <div role="group" aria-label={renderBilingual(mode, question.prompt_en, question.prompt_te).primary} className="grid gap-2.5">
        {question.options.map((o, i) => {
          const selected = arr.includes(o.id);
          return (
            <OptionCard
              key={o.id}
              multi
              label={renderBilingual(mode, o.label_en, o.label_te).primary}
              visual={visuals[i]}
              selected={selected}
              // No onCommit: the respondent is still choosing.
              onSelect={() => onChange(selected ? arr.filter((x) => x !== o.id) : [...arr, o.id])}
            />
          );
        })}
      </div>
    );
  }

  if (question.kind === "rating5") {
    return (
      <div className="flex justify-center py-2">
        <RatingStars
          value={typeof value === "number" ? value : null}
          onChange={(n) => {
            onChange(n);
            commitIfNew();
          }}
        />
      </div>
    );
  }

  const promptLabel = renderBilingual(mode, question.prompt_en, question.prompt_te).primary;

  if (question.kind === "short_text") {
    return (
      <Input
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        maxLength={300}
        className="h-14 rounded-field text-[17px]"
        placeholder={t("yourAnswer")}
        aria-label={promptLabel}
      />
    );
  }

  return (
    <Textarea
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      maxLength={2000}
      rows={5}
      className="rounded-field text-[17px] leading-relaxed"
      placeholder={t("yourAnswer")}
      aria-label={promptLabel}
    />
  );
}

/** Human-readable answer for the review list. */
export function describeAnswer(question: SurveyQuestion, value: AnswerValue, mode: LangMode): string | null {
  const lang = chromeLang(mode);
  if (value === null || value === undefined || value === "") return null;

  switch (question.kind) {
    case "multiple_choice":
    case "dropdown": {
      const opt = question.options.find((o) => o.id === value);
      return opt ? renderBilingual(mode, opt.label_en, opt.label_te).primary : null;
    }
    case "checkboxes": {
      const arr = Array.isArray(value) ? value : [];
      if (!arr.length) return null;
      return question.options
        .filter((o) => arr.includes(o.id))
        .map((o) => renderBilingual(mode, o.label_en, o.label_te).primary)
        .join(", ");
    }
    case "likert5":
      return typeof value === "number" ? (LIKERT_LABELS[lang][value - 1] ?? null) : null;
    case "yes_no":
      return value === "yes" ? (lang === "te" ? "అవును" : "Yes") : lang === "te" ? "కాదు" : "No";
    case "rating5":
      return typeof value === "number" ? `${value} / 5` : null;
    default:
      return typeof value === "string" ? value : null;
  }
}
