import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Clock, HeartHandshake, ListChecks, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { renderBilingual, useT, type LangMode } from "@/lib/i18n";
import type { Survey } from "@/lib/surveys";

/**
 * The first thing a credentialled family sees after the PIN screen.
 *
 * The rule: this screen exists to settle someone who has just been bereaved,
 * not to onboard a user. It carries the officer's greeting, the promise of
 * confidentiality, and one obvious way forward — and nothing else. There is no
 * navigation off this screen except into the assessment.
 */

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

// A local copy of the intro NoteCard: IntroStages keeps its version private, and
// duplicating twelve lines is cheaper than widening that module's surface for a
// flow it does not otherwise touch.
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

export function FamilyWelcomeStage({
  survey,
  mode,
  minutes,
  questionCount,
  familyHead,
  canResume,
  onBegin,
  onResume,
}: {
  survey: Survey;
  mode: LangMode;
  minutes: number;
  questionCount: number;
  familyHead: string;
  canResume: boolean;
  onBegin: () => void;
  onResume: () => void;
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
          {/* "Welcome" has no dictionary key yet — reported as a missing key. */}
          <h1 className="mt-2.5 t-hero text-balance">Welcome</h1>
          {/* The officer wrote this name down in the family's front room. Using it
              — quietly, not as a banner — is the difference between a form and a
              visit. */}
          {familyHead?.trim() && (
            <p className="mt-2 t-caption text-muted-foreground">
              {t("familyForCase", { name: familyHead.trim() })}
            </p>
          )}
          {/* The confidentiality promise is made once, in the privacy card below.
              Repeating privacyBody verbatim here would put the same paragraph on
              screen twice, which reads as boilerplate rather than reassurance. */}
          <p className="mx-auto mt-4 max-w-lg t-body text-balance leading-relaxed text-muted-foreground">
            Thank you for participating. {t("welcomeIntro")}
          </p>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <div className="mt-7 rounded-surface border border-border/70 bg-card">
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <span className="t-caption text-muted-foreground">{t("estimatedTime")}</span>
            <span className="inline-flex items-center gap-2 t-body font-medium">
              <Clock className="h-4 w-4 text-tertiary" strokeWidth={1.7} />
              {t("aboutMinutes", { n: minutes })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3.5">
            <span className="t-caption text-muted-foreground">{title}</span>
            <span className="inline-flex items-center gap-2 t-body font-medium">
              <ListChecks className="h-4 w-4 text-tertiary" strokeWidth={1.7} />
              {t("nQuestions", { n: questionCount })}
            </span>
          </div>
          {/* The header toggle is small and easy to miss on a borrowed phone. The
              spec puts the choice on the welcome screen on purpose, so it is made
              once, deliberately, before the first question. */}
          <div className="flex items-center justify-between gap-4 border-t border-border px-4 py-3">
            <span className="t-caption text-muted-foreground">{t("language")}</span>
            <LangToggle />
          </div>
        </div>
      </Reveal>

      {description && (
        <Reveal delay={0.16}>
          <p className="mx-auto mt-6 max-w-lg text-center t-body leading-relaxed text-muted-foreground">
            {description}
          </p>
        </Reveal>
      )}

      <Reveal delay={0.2}>
        <div className="mt-7 grid gap-3">
          <NoteCard icon={Lock} title={t("privacyTitle")} body={t("privacyBody")} />
          <NoteCard icon={HeartHandshake} title={t("supportTitle")} body={t("supportBody")} />
        </div>
      </Reveal>

      <Reveal delay={0.26}>
        {canResume ? (
          // Consent was captured on the earlier visit and is stored against the
          // case, so a returning family is never asked to read and affirm it a
          // second time — resume goes straight back into the questions.
          <div className="mt-8">
            <div className="rounded-surface border border-primary/25 bg-accent-tint p-4 text-center">
              <div className="t-card text-primary">{t("welcomeBack")}</div>
              <p className="mx-auto mt-1 max-w-md t-body text-muted-foreground">{t("resumeBody")}</p>
            </div>
            <Button onClick={onResume} size="xl" shape="pill" className="mt-4 w-full gap-2">
              {t("continueAssessment")}
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
            </Button>
            {/* Deliberately labelled "Begin", not "Start over": this hands control
                back to the container, which decides what a fresh start means for a
                case that already has server-side answers. Promising a wipe here
                would be a promise this stage cannot keep. */}
            <Button
              onClick={onBegin}
              variant="ghost"
              size="xl"
              shape="pill"
              className="mt-2 w-full text-muted-foreground"
            >
              {t("beginAssessment")}
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
