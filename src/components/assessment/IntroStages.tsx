import { useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Lock,
  HeartHandshake,
  Clock,
  ListChecks,
  Volume2,
  Save,
  Undo2,
  Check,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { Logo } from "@/components/Logo";
import { renderBilingual, useT, type LangMode } from "@/lib/i18n";
import type { Survey } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const EASE = [0.33, 1, 0.68, 1] as const;

function Reveal({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: EASE, delay: reduce ? 0 : delay }}
    >
      {children}
    </motion.div>
  );
}

function NoteCard({ icon: Icon, title, body }: { icon: typeof Lock; title: string; body: string }) {
  return (
    <div className="flex gap-3.5 rounded-surface border border-border/70 bg-card p-4">
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent-tint">
        <Icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.7} />
      </span>
      <div className="min-w-0">
        <div className="t-card">{title}</div>
        <p className="mt-1 t-body text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

// ── Welcome ────────────────────────────────────────────────────────────────

export function WelcomeStage({
  survey,
  mode,
  minutes,
  questionCount,
  canResume,
  onBegin,
  onResume,
  onStartOver,
}: {
  survey: Survey;
  mode: LangMode;
  minutes: number;
  questionCount: number;
  canResume: boolean;
  onBegin: () => void;
  onResume: () => void;
  onStartOver: () => void;
}) {
  const t = useT();
  const title = renderBilingual(mode, survey.title_en, survey.title_te).primary;
  const description = renderBilingual(mode, survey.description_en ?? "", survey.description_te).primary;

  return (
    <AssessmentShell>
      <Reveal>
        <Logo size={56} className="mx-auto" />
      </Reveal>

      <Reveal delay={0.06}>
        <div className="mt-6 text-center">
          <div className="eyebrow">{t("welcomeEyebrow")}</div>
          <h1 className="mt-2.5 t-hero text-balance">{title}</h1>
          <p className="mx-auto mt-4 max-w-lg t-body text-balance leading-relaxed text-muted-foreground">
            {description || t("welcomeIntro")}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mx-auto mt-6 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 t-caption text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-4 w-4" strokeWidth={1.7} />
            {t("aboutMinutes", { n: minutes })}
          </span>
          <span aria-hidden>·</span>
          <span>{t("nQuestions", { n: questionCount })}</span>
        </div>
      </Reveal>

      <Reveal delay={0.18}>
        <div className="mt-8 grid gap-3">
          <NoteCard icon={Lock} title={t("privacyTitle")} body={t("privacyBody")} />
          <NoteCard icon={HeartHandshake} title={t("supportTitle")} body={t("supportBody")} />
        </div>
      </Reveal>

      <Reveal delay={0.24}>
        {canResume ? (
          <div className="mt-8">
            <div className="rounded-surface border border-primary/25 bg-accent-tint p-4 text-center">
              <div className="t-card text-primary">{t("welcomeBack")}</div>
              <p className="mx-auto mt-1 max-w-md t-body text-muted-foreground">{t("resumeBody")}</p>
            </div>
            <Button onClick={onResume} size="xl" shape="pill" className="mt-4 w-full gap-2">
              {t("continueAssessment")}
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
            </Button>
            <Button onClick={onStartOver} variant="ghost" shape="pill" className="mt-2 w-full text-muted-foreground">
              <Undo2 className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {t("startOver")}
            </Button>
          </div>
        ) : (
          <Button onClick={onBegin} size="xl" shape="pill" className="mt-8 w-full gap-2">
            {t("beginAssessment")}
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
          </Button>
        )}
      </Reveal>
    </AssessmentShell>
  );
}

// ── Consent ────────────────────────────────────────────────────────────────

export function ConsentStage({ onAgree, onBack }: { onAgree: () => void; onBack: () => void }) {
  const t = useT();
  const [agreed, setAgreed] = useState(false);

  const points = [t("consentVoluntary"), t("consentConfidential"), t("consentResearch"), t("consentNoJudgement")];

  return (
    <AssessmentShell>
      <Reveal>
        <div className="text-center">
          <h1 className="t-title text-balance">{t("consentTitle")}</h1>
          <p className="mx-auto mt-3 max-w-md t-body text-balance text-muted-foreground">{t("consentIntro")}</p>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <ul className="mt-7 grid gap-2.5">
          {points.map((point) => (
            <li key={point} className="flex gap-3.5 rounded-surface border border-border/70 bg-card p-4">
              <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-success/15">
                <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 t-body leading-relaxed">{point}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.12}>
        {/* The consent affirmation is the whole card, not a 20px box beside a
            wall of text — the target that carries the legal weight should be
            the easiest one on the screen to hit. */}
        <button
          type="button"
          role="checkbox"
          aria-checked={agreed}
          onClick={() => setAgreed((v) => !v)}
          className={cn(
            "mt-7 flex min-h-[68px] w-full items-center gap-4 rounded-surface border-2 px-4 py-3.5 text-left transition-all duration-fast",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            agreed ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/45",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "grid h-7 w-7 shrink-0 place-items-center rounded-md border-2 transition-colors",
              agreed ? "border-primary bg-primary" : "border-border",
            )}
          >
            {agreed && <Check className="h-4 w-4 text-primary-foreground" strokeWidth={3} />}
          </span>
          <span className={cn("min-w-0 flex-1 text-[17px] leading-snug", agreed ? "font-semibold" : "font-medium")}>
            {t("consentAgree")}
          </span>
        </button>
      </Reveal>

      <Reveal delay={0.18}>
        <div className="mt-6 flex gap-3">
          <Button onClick={onBack} variant="ghost" size="xl" shape="pill" className="gap-2 px-5 text-muted-foreground">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {t("back")}
          </Button>
          <Button onClick={onAgree} disabled={!agreed} size="xl" shape="pill" className="flex-1 gap-2">
            {t("continue")}
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
          </Button>
        </div>
      </Reveal>
    </AssessmentShell>
  );
}

// ── Instructions ───────────────────────────────────────────────────────────

export function InstructionsStage({ onStart, onBack }: { onStart: () => void; onBack: () => void }) {
  const t = useT();

  const items = [
    { icon: ListChecks, text: t("instructionOneAtATime") },
    { icon: Volume2, text: t("instructionListen") },
    { icon: Save, text: t("instructionAutoSave") },
    { icon: Undo2, text: t("instructionGoBack") },
  ];

  return (
    <AssessmentShell>
      <Reveal>
        <h1 className="text-center t-title text-balance">{t("instructionsTitle")}</h1>
      </Reveal>

      <Reveal delay={0.06}>
        <ul className="mt-7 grid gap-3">
          {items.map((item) => (
            <li key={item.text} className="flex gap-3.5 rounded-surface border border-border/70 bg-card p-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent-tint">
                <item.icon className="h-[18px] w-[18px] text-primary" strokeWidth={1.7} />
              </span>
              <span className="min-w-0 self-center t-body leading-relaxed">{item.text}</span>
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-8 flex gap-3">
          <Button onClick={onBack} variant="ghost" size="xl" shape="pill" className="gap-2 px-5 text-muted-foreground">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {t("back")}
          </Button>
          <Button onClick={onStart} size="xl" shape="pill" className="flex-1 gap-2">
            {t("startQuestions")}
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
          </Button>
        </div>
      </Reveal>
    </AssessmentShell>
  );
}
