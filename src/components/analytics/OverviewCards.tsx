import { motion } from "framer-motion";
import { Users, CalendarCheck2, Gauge, Timer, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { SurveyStats } from "@/lib/analytics";

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "—";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "No responses yet";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function OverviewCards({ stats }: { stats: SurveyStats | null }) {
  const cards = [
    { label: "Total responses", value: stats ? stats.totalResponses.toLocaleString() : undefined, icon: Users, tone: "primary" as const },
    { label: "Responses today", value: stats ? stats.responsesToday.toLocaleString() : undefined, icon: CalendarCheck2, tone: "success" as const },
    { label: "Completion rate", value: stats ? (stats.completionRate == null ? "—" : `${Math.round(stats.completionRate * 100)}%`) : undefined, icon: Gauge, tone: "warning" as const },
    { label: "Avg. time to complete", value: stats ? formatDuration(stats.avgSecondsToComplete) : undefined, icon: Timer, tone: "primary" as const },
    { label: "Last response", value: stats ? formatRelative(stats.lastResponseAt) : undefined, icon: Clock, tone: "success" as const },
  ];

  const toneClass = { primary: "bg-accent text-primary", success: "bg-success/10 text-success", warning: "bg-warning/15 text-warning" };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((c, i) => (
        <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="rounded-surface border border-border/70 bg-card shadow-sm hover:shadow-md transition-shadow p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="eyebrow">{c.label}</div>
              <div className="mt-1.5 t-title font-semibold tracking-tight tabular-nums truncate">
                {c.value === undefined ? <Skeleton className="h-6 w-14" /> : c.value}
              </div>
            </div>
            <div className={`h-8 w-8 sm:h-9 sm:w-9 shrink-0 rounded-control grid place-items-center ${toneClass[c.tone]}`}>
              <c.icon className="h-4 w-4" />
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
