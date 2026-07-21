import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { useT } from "@/lib/i18n";

const EASE = [0.33, 1, 0.68, 1] as const;

/**
 * What the retired anonymous survey link now shows.
 *
 * `/s/:slug` used to open a full assessment to anyone holding the slug. That is
 * incompatible with a controlled research platform: a leaked or forwarded slug
 * was an uncredentialled way into the same instrument a family had to enter a
 * PIN to reach, so the PIN was protecting nothing. The route is retired at the
 * router rather than by deleting the runner page, which keeps the change to one
 * line and trivially reversible.
 *
 * The tone matters more than the mechanism. Someone landing here is most likely
 * a family member who scanned an old printed code — they are not doing anything
 * wrong, and this page must not read like an access-denied wall. It names the
 * one thing they need (a link and PIN from their officer) and offers the door.
 */
export default function SecureAccessNotice() {
  const t = useT();
  const reduce = useReducedMotion();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="border-b border-border/60 bg-card/90">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-5 sm:px-6">
          <Logo size={36} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate t-caption font-semibold text-foreground">{t("appShort")}</div>
            <div className="truncate text-[11px] font-medium text-muted-foreground">{t("orgLine")}</div>
          </div>
          <LangToggle size="sm" />
        </div>
      </header>

      <div className="grid flex-1 place-items-center px-6 py-12">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: EASE }}
          className="w-full max-w-sm text-center"
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <ShieldCheck className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>

          <h1 className="mt-6 t-section text-balance">{t("secureAccessTitle")}</h1>
          <p className="mx-auto mt-3 t-body text-balance leading-relaxed text-muted-foreground">
            {t("secureAccessBody")}
          </p>

          <Button asChild className="mt-8 h-14 w-full gap-2 rounded-pill text-base">
            <Link to="/family">
              {t("secureAccessAction")}
              <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />
            </Link>
          </Button>

          <p className="mt-6 t-caption text-muted-foreground">{t("familyNeedHelp")}</p>
        </motion.div>
      </div>
    </div>
  );
}
