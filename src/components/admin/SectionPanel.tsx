import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The titled block every dashboard and report section is made of. Lifted out of
 * Overview.tsx, where it was a private component that four other pages then
 * reimplemented slightly differently.
 */
export function SectionPanel({
  title,
  icon: Icon,
  sub,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  icon?: LucideIcon;
  sub?: string;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("card-premium flex flex-col p-5", className)}>
      <div className="mb-3 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} />}
        <h2 className="t-card">{title}</h2>
        {sub && <span className="truncate t-caption text-muted-foreground">· {sub}</span>}
        {action && <div className="ml-auto shrink-0">{action}</div>}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/** A labelled horizontal meter — completion rates, distribution shares. */
export function MeterRow({
  label,
  value,
  max,
  caption,
  tone = "primary",
}: {
  label: string;
  value: number;
  max: number;
  caption?: string;
  tone?: "primary" | "muted";
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 t-caption">
        <span className="min-w-0 truncate text-muted-foreground">{label}</span>
        <span className="shrink-0 font-semibold tabular-nums text-foreground">{caption ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-pill bg-sunken">
        <div
          className={cn(
            "h-full rounded-pill transition-[width] duration-slow ease-out",
            tone === "primary" ? "bg-primary" : "bg-border-strong",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
