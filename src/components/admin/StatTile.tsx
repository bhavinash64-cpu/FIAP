import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The console's KPI tile.
 *
 * Four near-identical versions of this had grown up independently (Responses'
 * Stat, Analytics' Summary, the dashboard's Kpi, Export's Meta), each with its
 * own padding and icon size, and each spending roughly 120px of height to show
 * one number. This is the single compact one: the icon sits inline with the
 * label rather than on its own row, which is most of the height back.
 */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  trend,
  tone = "default",
  loading,
  className,
}: {
  icon?: LucideIcon;
  label: string;
  value: ReactNode;
  sub?: string;
  trend?: { value: number; direction: "up" | "down" | "flat" };
  tone?: "default" | "primary";
  loading?: boolean;
  className?: string;
}) {
  const TrendIcon = trend?.direction === "up" ? TrendingUp : trend?.direction === "down" ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        "card-premium flex min-w-0 flex-col justify-center p-4",
        tone === "primary" && "bg-primary-tint/40",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 eyebrow text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />}
        <span className="truncate">{label}</span>
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-7 w-20" />
      ) : (
        <div className="mt-1.5 flex items-end gap-2">
          <span className="t-title leading-none tabular-nums">{value}</span>
          {trend && (
            <span
              className={cn(
                "mb-0.5 inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                trend.direction === "up" && "bg-[hsl(var(--success)/0.12)] text-success",
                trend.direction === "down" && "bg-danger/10 text-danger",
                trend.direction === "flat" && "bg-muted text-muted-foreground",
              )}
            >
              <TrendIcon className="h-3 w-3" strokeWidth={2.2} />
              {trend.direction === "flat" ? "—" : `${trend.value > 0 ? "+" : ""}${Math.round(trend.value)}%`}
            </span>
          )}
        </div>
      )}

      {sub && <div className="mt-1 truncate t-caption text-tertiary">{sub}</div>}
    </div>
  );
}
