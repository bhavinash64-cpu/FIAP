import { motion } from "framer-motion";
import { useI18nStore, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const options: { value: Lang; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "te", label: "తె" },
];

export function LangToggle({ size = "md" }: { size?: "sm" | "md" }) {
  const lang = useI18nStore((s) => s.lang);
  const setLang = useI18nStore((s) => s.setLang);
  const h = size === "sm" ? "h-8" : "h-9";
  const px = size === "sm" ? "px-2.5" : "px-3";

  return (
    <div
      role="group"
      aria-label="Language"
      className={cn("relative inline-flex items-center rounded-full border border-border/70 bg-white/70 backdrop-blur p-0.5", h)}
    >
      {options.map((o) => {
        const active = lang === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setLang(o.value)}
            className={cn(
              "relative z-10 rounded-full text-xs font-semibold transition-colors",
              px,
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <motion.span
                layoutId="lang-pill"
                className="absolute inset-0 -z-10 rounded-full brand-gradient shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
