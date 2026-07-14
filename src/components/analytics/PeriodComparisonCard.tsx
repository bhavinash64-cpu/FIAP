import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PeriodComparison, Period } from "@/lib/analytics";

const PERIOD_LABEL: Record<Period, { current: string; previous: string }> = {
  week: { current: "This week", previous: "last week" },
  month: { current: "This month", previous: "last month" },
  year: { current: "This year", previous: "last year" },
};

export function PeriodComparisonCard({ period, data }: { period: Period; data: PeriodComparison }) {
  const labels = PERIOD_LABEL[period];
  const up = (data.pctChange ?? 0) >= 0;
  const Icon = data.pctChange == null ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-5">
      <div className="text-xs font-medium text-muted-foreground">{labels.current}</div>
      <div className="mt-1.5 flex items-end gap-3">
        <div className="text-4xl font-semibold tracking-tight tabular-nums">{data.current}</div>
        <div className={`flex items-center gap-1 text-sm font-semibold mb-1 ${data.pctChange == null ? "text-muted-foreground" : up ? "text-success" : "text-destructive"}`}>
          <Icon className="h-4 w-4" />
          {data.pctChange == null ? "new" : `${up ? "+" : ""}${Math.round(data.pctChange)}%`}
        </div>
      </div>
      <div className="mt-1 text-xs text-muted-foreground">vs {data.previous} {labels.previous}</div>
    </div>
  );
}
