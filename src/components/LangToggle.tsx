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
 *  - It must not move. See the note on the pill below.
 */
export function LangToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const mode = useI18nStore((s) => s.mode);
  const setMode = useI18nStore((s) => s.setMode);
  const t = useT();

  const h = size === "sm" ? "h-8" : "h-9";
  const px = size === "sm" ? "px-2.5" : "px-3";

  /*
    No LayoutGroup and no layoutId here — deliberately.

    The pill used to be a framer-motion shared element so it would SLIDE between
    the two options. Inside one toggle that is a nice touch. Across the app it is
    a bug: `layoutId` is global, so the instant a second toggle mounts — the
    landing header and its footer, or the outgoing page's toggle overlapping the
    incoming one during a route change to Settings or Sign in — framer-motion
    treats them as the same element and animates the pill flying across the
    viewport between the two. There is no correct shared-element answer when the
    "same" element legitimately exists twice, so the animation goes.

    Switching language is instant and unambiguous without it; the colour
    transition alone carries the change.
  */
  return (
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
              {active && <span className="brand-gradient absolute inset-0 z-0 rounded-pill shadow-sm" />}
              <span className="relative z-10">{o.label}</span>
            </button>
          );
        })}
      </div>
  );
}
