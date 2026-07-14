import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { RangeKey } from "@/lib/analytics";

const OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "12m", label: "Last 12 months" },
];

export function RangeSwitcher({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <div role="tablist" aria-label="Time range" className="relative inline-flex items-center rounded-full border border-border/70 bg-white/70 backdrop-blur p-0.5 h-9">
      {OPTIONS.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 rounded-full px-3 h-8 text-xs font-semibold transition-colors whitespace-nowrap",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span layoutId="range-pill" className="absolute inset-0 -z-10 rounded-full brand-gradient shadow-sm" transition={{ type: "spring", stiffness: 420, damping: 32 }} />
            )}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
