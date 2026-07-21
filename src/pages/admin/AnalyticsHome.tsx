import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight, BarChart3, CheckCircle2, Clock3, Hourglass, Plus, QrCode } from "lucide-react";
import { listSurveys } from "@/lib/surveys";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { EmptyChartArt, EmptyState } from "@/components/admin/EmptyState";
import { SectionPanel } from "@/components/admin/SectionPanel";
import { StatTile } from "@/components/admin/StatTile";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Analytics is a DOORWAY, not a third dashboard.
 *
 * Its only job is picking which survey to open a per-question dashboard for, so
 * everything that used to restate the dashboard's counters is gone and the two
 * remaining views are complementary rather than three renderings of one list:
 * a comparison chart to see where the data is, and a list to go there. The
 * tiles left behind are about analysis COVERAGE — a fact neither the dashboard
 * nor Reports shows.
 */
export default function AnalyticsHome() {
  const t = useT();
  const { data: surveys = [], isPending, isError } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });

  const coverage = useMemo(() => {
    const withData = surveys.filter((s) => s.response_count > 0);
    const awaiting = surveys.filter((s) => s.response_count === 0 && s.status === "published");
    const counts = withData.map((s) => s.response_count).sort((a, b) => a - b);
    const mid = Math.floor(counts.length / 2);
    const medianCount = counts.length
      ? counts.length % 2
        ? counts[mid]
        : Math.round((counts[mid - 1] + counts[mid]) / 2)
      : 0;
    return { withData: withData.length, awaiting: awaiting.length, medianCount };
  }, [surveys]);

  const chartData = useMemo(
    () =>
      [...surveys]
        .filter((s) => s.response_count > 0)
        .sort((a, b) => b.response_count - a.response_count)
        .slice(0, 10)
        .map((s) => ({
          name: s.title_en.length > 18 ? `${s.title_en.slice(0, 17)}…` : s.title_en,
          responses: s.response_count,
        })),
    [surveys],
  );

  const ranked = useMemo(() => [...surveys].sort((a, b) => b.response_count - a.response_count), [surveys]);
  const hasData = coverage.withData > 0;

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupInsights")}
        title={t("navAnalytics")}
        subtitle="Open a survey to explore its per-question breakdowns, response trends and text answers."
      />

      {isPending ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-12">
          <Skeleton className="h-[5.25rem] rounded-surface lg:col-span-12" />
          <Skeleton className="h-96 rounded-surface lg:col-span-8" />
          <Skeleton className="h-96 rounded-surface lg:col-span-4" />
        </div>
      ) : isError ? (
        <div className="mt-8 rounded-surface border border-danger/30 bg-danger/5 p-8 text-center">
          <p className="t-body font-medium">Couldn't load surveys.</p>
          <p className="mt-1 t-caption text-muted-foreground">Reload the page to try again.</p>
        </div>
      ) : !hasData ? (
        <div className="mt-6 rounded-surface border border-border/70 bg-card">
          <EmptyState
            illustration={<EmptyChartArt />}
            title="Collect survey responses to unlock insights."
            description={
              surveys.length === 0
                ? "Create and publish a survey — per-question breakdowns, response trends and text-answer review appear as soon as families begin answering."
                : "Your surveys are ready but nothing has come in yet. Share a QR code or link, and the first response opens the dashboards."
            }
            primaryAction={
              <Button asChild>
                <Link to={surveys.length === 0 ? "/app/surveys" : "/app/qr"}>
                  {surveys.length === 0 ? <Plus strokeWidth={1.6} /> : <QrCode strokeWidth={1.6} />}
                  {surveys.length === 0 ? "New survey" : "Open QR manager"}
                </Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link to="/app/surveys">Go to surveys</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
            <StatTile icon={CheckCircle2} label="Ready to analyse" value={coverage.withData} sub="surveys with responses" tone="primary" />
            <StatTile icon={Hourglass} label="Awaiting data" value={coverage.awaiting} sub="published, nothing yet" />
            <StatTile icon={Clock3} label="Typical volume" value={coverage.medianCount} sub="median responses per survey" />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-12">
            <SectionPanel title="Where the data is" icon={BarChart3} sub="Top surveys by responses" className="lg:col-span-8">
              <div className="h-[19rem] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} interval={0} angle={chartData.length > 5 ? -20 : 0} textAnchor={chartData.length > 5 ? "end" : "middle"} height={chartData.length > 5 ? 56 : 30} />
                    <YAxis tick={{ fontSize: 13, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted) / 0.5)" }}
                      contentStyle={{ borderRadius: 14, border: "1px solid hsl(var(--border))", fontSize: 13, boxShadow: "var(--shadow-md)" }}
                    />
                    <Bar dataKey="responses" radius={[8, 8, 0, 0]} animationDuration={700}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill="hsl(var(--primary))" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionPanel>

            <SectionPanel title="Open a dashboard" icon={ArrowUpRight} className="lg:col-span-4">
              <ul className="thin-scrollbar -mr-1 max-h-[19rem] space-y-1.5 overflow-y-auto pr-1">
                {ranked.map((s) => {
                  const analysable = s.response_count > 0;
                  return (
                    <li key={s.id}>
                      <Link
                        to={`/app/surveys/${s.id}/analytics`}
                        className={cn(
                          "group flex items-center gap-3 rounded-[12px] border border-border/70 px-3 py-2.5 transition-colors duration-fast hover:border-primary/40 hover:bg-muted/40",
                          !analysable && "opacity-70",
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate t-caption font-semibold group-hover:text-primary">{s.title_en}</span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <StatusBadge status={s.status} />
                            <span className="t-caption tabular-nums text-tertiary">
                              {s.response_count} response{s.response_count === 1 ? "" : "s"}
                            </span>
                          </span>
                        </span>
                        <ArrowUpRight
                          className="h-4 w-4 shrink-0 text-tertiary transition-transform duration-base ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                          strokeWidth={1.7}
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </SectionPanel>
          </div>
        </>
      )}
    </PageContainer>
  );
}
