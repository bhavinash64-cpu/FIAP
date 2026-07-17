import { useI18nStore, type LangMode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const options: { value: LangMode; label: string; hint: string }[] = [
  { value: "te", label: "తెలుగు", hint: "Telugu" },
  { value: "en", label: "English", hint: "English" },
];

export function LangToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const mode = useI18nStore((s) => s.mode);
  const setMode = useI18nStore((s) => s.setMode);
  const h = size === "sm" ? "h-8" : "h-9";
  const px = size === "sm" ? "px-2.5" : "px-3";
  const text = size === "sm" ? "t-caption" : "text-eyebrow";

  return (
    <div
      role="group"
      aria-label="Language"
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
              "relative z-10 rounded-pill font-semibold transition-colors",
              px,
              text,
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && <span className="brand-gradient absolute inset-0 -z-10 rounded-pill shadow-sm" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
