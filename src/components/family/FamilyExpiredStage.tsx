import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarX2, LogIn, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n";

/**
 * The dead end of the respondent route: the link has run out, the session has
 * gone, or the assessment cannot be loaded at all.
 *
 * The rule: a family must never be shown a failure they are expected to fix
 * themselves. Only the session case offers an action, because signing in again
 * genuinely works; an expired or unavailable case ends with a sentence pointing
 * at the field officer and no button to press hopefully.
 */

const EASE = [0.33, 1, 0.68, 1] as const;

export function FamilyExpiredStage({ reason }: { reason: "expired" | "session" | "unavailable" }) {
  const t = useT();
  const reduce = useReducedMotion();

  const view =
    reason === "expired"
      ? { icon: CalendarX2, title: t("statusExpired"), body: t("familyErrExpired"), action: false }
      : reason === "session"
        ? { icon: LogIn, title: t("secureAccessTitle"), body: t("familySessionEnded"), action: true }
        : { icon: SearchX, title: t("somethingWrongTitle"), body: t("somethingWrongBody"), action: false };

  const Icon = view.icon;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-5 sm:px-6">
          <Logo size={36} />
          <div className="t-caption font-semibold text-muted-foreground">{t("appShort")}</div>
          <div className="ml-auto">
            <LangToggle size="sm" />
          </div>
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="max-w-sm text-center"
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 t-section">{view.title}</h1>
          <p className="mt-2 t-body leading-relaxed text-muted-foreground">{view.body}</p>

          {view.action && (
            <Button asChild size="xl" shape="pill" className="mt-7 w-full">
              <Link to="/family">{t("secureAccessAction")}</Link>
            </Button>
          )}
        </motion.div>
      </div>
    </div>
  );
}
