import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { LifeBuoy, Lock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The quiet support affordance that sits on every stage of the family flow.
 *
 * Three deliberate constraints, because a well-being questionnaire is exactly
 * the wrong place for an attention-seeking widget:
 *
 *  - It never interrupts. No auto-open, no pulse, no badge. It waits.
 *  - It never covers an answer. When the stage has an action bar it floats
 *    above it; the answer column is capped at 40rem and centred, so on a wide
 *    screen the button sits in dead margin, and on a phone it clears the
 *    Previous/Next row rather than overlapping it.
 *  - It offers information, not a referral. The platform has no crisis line to
 *    route to and inventing one would be worse than saying nothing, so the
 *    modal points at the services a respondent actually has: emergency
 *    services, their own people, a professional they can reach.
 */
export function SupportButton({ raised = false }: { raised?: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();

  return (
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, delay: 0.6, ease: [0.33, 1, 0.68, 1] }}
        whileHover={reduce ? undefined : { y: -2 }}
        whileTap={reduce ? undefined : { scale: 0.96 }}
        className={cn(
          "fixed right-4 z-40 inline-flex h-12 items-center gap-2 rounded-pill border border-border/70 bg-card/95 pl-3.5 pr-4",
          "shadow-float backdrop-blur-xl transition-colors duration-base ease-out sm:right-6",
          "hover:border-primary/40 hover:bg-card",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // Clears the sticky action bar (52px control + 12px padding top and
          // bottom) plus the home-indicator inset on stages that have one.
          raised
            ? "bottom-[calc(76px+env(safe-area-inset-bottom)+0.75rem)]"
            : "bottom-[calc(env(safe-area-inset-bottom)+1rem)]",
        )}
      >
        <LifeBuoy className="h-[18px] w-[18px] text-primary" strokeWidth={1.8} />
        <span className="t-caption font-semibold">{t("needHelp")}</span>
      </motion.button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <span className="mb-1 grid h-11 w-11 place-items-center rounded-control bg-accent-tint">
              <Lock className="h-5 w-5 text-primary" strokeWidth={1.7} />
            </span>
            <DialogTitle className="t-section">{t("helpTitle")}</DialogTitle>
            <DialogDescription className="t-body leading-relaxed text-muted-foreground">
              {t("helpBody")}
            </DialogDescription>
          </DialogHeader>

          <p className="rounded-field bg-muted/60 px-3.5 py-3 t-caption leading-relaxed text-muted-foreground">
            {t("helpReminder")}
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} className="gap-2">
              <X strokeWidth={1.8} />
              {t("close")}
            </Button>
            <Button onClick={() => setOpen(false)} className="gap-2">
              {t("continueSurvey")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
