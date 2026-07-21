import { LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useI18nStore, useT, type LangMode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const options: { value: LangMode; label: string; hint: string }[] = [
  { value: "te", label: "తెలుగు", hint: "Telugu" },
  { value: "en", label: "English", hint: "English" },
];

/**
 * The language switch. It appears on the admin topbar, the landing header and —
 * most importantly — the header of every stage of the family assessment, where
 * it may be the first control a respondent touches.
 *
 * Three things it has to get right:
 *  - It must be reachable. The visual pill is 32/36px tall, well under the 44px
 *    minimum, so each option projects a 48px hit area with `touch-halo` rather
 *    than inflating the control itself.
 *  - It must show focus. It is a bare <button> outside the Button cva, so the
 *    house focus ring is applied explicitly.
 *  - The active pill SLIDES between the two options instead of disappearing and
 *    reappearing. Switching language is the one interaction that has to feel
 *    reversible, and a shared-element transition is what says "same control,
 *    other side" rather than "something else happened".
 */
export function LangToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const mode = useI18nStore((s) => s.mode);
  const setMode = useI18nStore((s) => s.setMode);
  const t = useT();
  const reduce = useReducedMotion();

  const h = size === "sm" ? "h-8" : "h-9";
  const px = size === "sm" ? "px-2.5" : "px-3";

  return (
    <LayoutGroup id="lang-toggle">
      <div
        role="group"
        aria-label={t("languageGroup")}
        className={cn(
          "relative inline-flex items-center rounded-pill border border-border/70 bg-card/70 p-0.5 backdrop-blur",
          h,
        )}
      >
        {options.map((o) => {
          const active = mode === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setMode(o.value)}
              title={o.hint}
              aria-pressed={active}
              className={cn(
                "touch-halo relative z-10 inline-flex h-full items-center rounded-pill t-caption font-semibold",
                "transition-colors duration-fast ease-out",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] focus-visible:ring-offset-1 focus-visible:ring-offset-background",
                px,
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {/*
                z-0 inside the button, NOT -z-10.

                A negative z-index escapes the button and is painted against the
                nearest ancestor that forms a stacking context. Wherever the
                toggle sits on a `backdrop-blur` bar — the landing header, the
                admin topbar — that ancestor's own background then covers the
                pill, and the active option becomes white text on white: the
                control renders as a single word with a blank space beside it.
                Keeping the pill and the label in the button's own stacking
                context makes the toggle independent of whatever it is placed on.
              */}
              {active &&
                (reduce ? (
                  <span className="brand-gradient absolute inset-0 z-0 rounded-pill shadow-sm" />
                ) : (
                  <motion.span
                    layoutId="lang-toggle-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="brand-gradient absolute inset-0 z-0 rounded-pill shadow-sm"
                  />
                ))}
              <span className="relative z-10">{o.label}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
