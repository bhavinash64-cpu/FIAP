import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Gauge,
  Languages,
  Layers,
  LineChart,
  ListChecks,
  Minus,
  Plus,
  QrCode,
  ShieldAlert,
  Table2,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { EmptyState, EmptyReportArt } from "@/components/admin/EmptyState";
import { InsightsTabs } from "@/components/admin/InsightsTabs";
import { MeterRow, SectionPanel } from "@/components/admin/SectionPanel";
import { StatTile } from "@/components/admin/StatTile";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { CountUp } from "@/components/CountUp";
import { getSurveyResponseSummaries, listResponses } from "@/lib/responseExplorer";
import {
  buildCompletionStats,
  buildLanguageBreakdown,
  buildSurveyComparison,
  buildTrend,
  formatDuration,
  getInstrumentAnalytics,
  getQuestionStatistics,
  periodNoun,
  periodOverPeriod,
  scopeRows,
  type TrendPeriod,
} from "@/lib/reports";
import { exportRelTime, loadExportHistory } from "@/lib/exportHistory";
import { cn } from "@/lib/utils";

/**
 * Reports is RESEARCH ANALYSIS. The dashboard answers "what is happening right
 * now"; this answers "what does the data say" — periodised, comparative and
 * printable for official review. Nothing here duplicates a dashboard widget:
 * no activity feed, no quick actions, no live status donut.
 *
 * Every figure except the two relational sections is computed synchronously
 * from the same ["all-responses"] cache the Responses workspace fills, so
 * changing survey or period is instant rather than a round trip.
 */

const PERIOD_LABEL: Record<TrendPeriod, { current: string; previous: string; window: string }> = {
  week: { current: "This week", previous: "last week", window: "Last 12 weeks" },
  month: { current: "This month", previous: "last month", window: "Last 12 months" },
  year: { current: "This year", previous: "last year", window: "Last 5 years" },
};

const CHART_TOOLTIP = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  fontSize: 12,
  boxShadow: "var(--shadow-md)",
} as const;

const LANGUAGE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent-foreground, var(--primary)) / 0.45)"];

export default function Reports() {
  const [surveyId, setSurveyId] = useState<string>("all");
  const [period, setPeriod] = useState<TrendPeriod>("week");
  const [showQuestions, setShowQuestions] = useState(false);

  const { data: rows, isPending, isError } = useQuery({ queryKey: ["all-responses"], queryFn: listResponses });
  const { data: summaries } = useQuery({
    queryKey: ["survey-response-summaries"],
    queryFn: getSurveyResponseSummaries,
  });

  const allRows = useMemo(() => rows ?? [], [rows]);
  const allSummaries = useMemo(() => summaries ?? [], [summaries]);

  const scoped = useMemo(() => scopeRows(allRows, surveyId), [allRows, surveyId]);
  const trend = useMemo(() => buildTrend(allRows, period, surveyId), [allRows, period, surveyId]);
  const delta = useMemo(() => periodOverPeriod(allRows, period, surveyId), [allRows, period, surveyId]);
  const languages = useMemo(() => buildLanguageBreakdown(allRows, surveyId), [allRows, surveyId]);
  const completion = useMemo(
    () => buildCompletionStats(allRows, allSummaries, surveyId),
    [allRows, allSummaries, surveyId],
  );
  const comparison = useMemo(() => buildSurveyComparison(allSummaries, allRows), [allSummaries, allRows]);
  const history = useMemo(() => loadExportHistory(), []);

  const selected = surveyId === "all" ? null : allSummaries.find((s) => s.id === surveyId) ?? null;
  const labels = PERIOD_LABEL[period];

  // Question statistics are N RPCs — only fetched once the section is opened,
  // and never for "All surveys", which would fan out across the whole account.
  const { data: questionStats, isPending: questionsPending } = useQuery({
    queryKey: ["question-statistics", surveyId],
    queryFn: () => getQuestionStatistics(surveyId),
    enabled: showQuestions && surveyId !== "all",
  });

  const { data: instruments, isPending: instrumentsPending } = useQuery({
    queryKey: ["instrument-analytics"],
    queryFn: getInstrumentAnalytics,
  });

  const up = (delta.pctChange ?? 0) >= 0;
  const TrendIcon = delta.pctChange == null ? Minus : up ? TrendingUp : TrendingDown;

  /** The conclusion first — that is what an executive summary is for. */
  const insight = (() => {
    const scopeName = selected ? selected.title : "all surveys";
    if (!allRows.length) return `No responses have been recorded for ${scopeName} yet.`;
    if (delta.current === 0 && delta.previous === 0) {
      return `Nothing arrived ${labels.current.toLowerCase()} for ${scopeName}; the last response was ${
        scoped.length ? new Date(scoped[0].submittedAt).toLocaleDateString() : "some time ago"
      }.`;
    }
    const langLine = languages.length > 1
      ? ` ${Math.round((languages[0].pct ?? 0) * 100)}% answered in ${languages[0].label}.`
      : "";
    if (delta.pctChange == null) {
      return `${delta.current} response${delta.current === 1 ? "" : "s"} arrived ${labels.current.toLowerCase()} — the first on record for this ${periodNoun(period)}.${langLine}`;
    }
    return `Responses are ${up ? "up" : "down"} ${Math.abs(Math.round(delta.pctChange))}% against ${labels.previous}, ${delta.current} this ${periodNoun(period)} versus ${delta.previous} before.${langLine}`;
  })();

  const reportHref = selected
    ? `/app/surveys/${selected.id}/report?range=${period}`
    : comparison[0]
      ? `/app/surveys/${comparison[0].id}/report?range=${period}`
      : null;

  if (isPending) return <ReportsSkeleton />;

  if (isError) {
    return (
      <PageContainer>
        <PageHeader eyebrow="Insights" title="Reports" subtitle="Period-over-period research analysis." />
        <div className="mt-8 rounded-surface border border-danger/30 bg-danger/5 p-8 text-center">
          <p className="t-body font-medium">Couldn't load the response data these reports are built from.</p>
          <p className="mt-1 t-caption text-muted-foreground">This was a network or permission error — not an empty account.</p>
        </div>
      </PageContainer>
    );
  }

  if (!allSummaries.length || !allRows.length) {
    return (
      <PageContainer>
        <PageHeader eyebrow="Insights" title="Reports" subtitle="Period-over-period research analysis, ready for official review." />
        <InsightsTabs />
        <div className="mt-6 rounded-surface border border-border/70 bg-card">
          <EmptyState
            illustration={<EmptyReportArt />}
            title="No reports generated yet."
            description="Publish a survey and collect responses — weekly, monthly and yearly analysis, completion statistics and question-level breakdowns all unlock automatically."
            primaryAction={
              <Button asChild>
                <Link to="/app/surveys">
                  <Plus strokeWidth={1.6} /> New survey
                </Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link to="/app/qr">
                  <QrCode strokeWidth={1.6} /> Open QR manager
                </Link>
              </Button>
            }
          />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Research analysis"
        title="Reports"
        subtitle="Trends, completion and question-level findings across the programme — periodised for official review."
        actions={
          <>
            <Select value={surveyId} onValueChange={setSurveyId}>
              <SelectTrigger className="w-full sm:w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All surveys</SelectItem>
                {allSummaries.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as TrendPeriod)}>
              <TabsList className="rounded-control bg-sunken">
                <TabsTrigger value="week" className="rounded-control">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="rounded-control">Monthly</TabsTrigger>
                <TabsTrigger value="year" className="rounded-control">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />

      <InsightsTabs />

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* 1 · Executive summary */}
        <section className="relative overflow-hidden rounded-surface border border-border/70 bg-card p-5 sm:p-6 lg:col-span-12">
          <div className="glow-gradient pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-pill opacity-70" />
          <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div className="min-w-0">
              <div className="eyebrow text-primary">
                Executive summary · {labels.current} · {selected ? selected.title : "All surveys"}
              </div>
              <div className="mt-3 flex items-end gap-3">
                <span className="t-display leading-none tabular-nums">
                  <CountUp value={delta.current} />
                </span>
                <Badge variant={delta.pctChange == null ? "secondary" : up ? "success" : "danger"} className="mb-2">
                  <TrendIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                  {delta.pctChange == null ? "new" : `${up ? "+" : ""}${Math.round(delta.pctChange)}%`}
                </Badge>
                <span className="mb-1.5 t-caption text-muted-foreground">
                  new response{delta.current === 1 ? "" : "s"} this {periodNoun(period)}
                </span>
              </div>
              <p className="mt-4 max-w-2xl t-section font-normal leading-snug text-balance">{insight}</p>
            </div>

            <dl className="grid grid-cols-3 gap-3 lg:w-[26rem]">
              <StatTile icon={Activity} label="Total" value={scoped.length} sub="all time" />
              <StatTile
                icon={Gauge}
                label="Completion"
                value={completion.avgCompletionRate == null ? "—" : `${Math.round(completion.avgCompletionRate * 100)}%`}
                sub="submitted vs opened"
              />
              <StatTile icon={Clock3} label="Avg time" value={formatDuration(completion.avgSecondsToComplete)} sub="to complete" />
            </dl>
          </div>
        </section>

        {/* 2 · Response trend */}
        <SectionPanel
          title="Response trend"
          icon={LineChart}
          sub={labels.window}
          className="lg:col-span-8"
          action={
            <span className="t-caption tabular-nums text-tertiary">
              {trend.reduce((n, p) => n + p.count, 0)} in window
            </span>
          }
        >
          <div className="relative h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                <defs>
                  <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 13, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 13, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
                <Tooltip cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }} contentStyle={CHART_TOOLTIP} />
                <Area type="monotone" dataKey="count" name="Responses" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#trendFill)" animationDuration={800} />
              </AreaChart>
            </ResponsiveContainer>
            {scoped.length === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="rounded-pill bg-muted px-3 py-1 t-caption text-muted-foreground">
                  No responses in this scope yet
                </span>
              </div>
            )}
          </div>
        </SectionPanel>

        {/* 3 · Completion */}
        <SectionPanel title="Completion" icon={Gauge} className="lg:col-span-4" bodyClassName="space-y-4">
          <div className="flex items-end gap-3">
            <span className="t-title leading-none tabular-nums">
              {completion.avgCompletionRate == null ? "—" : `${Math.round(completion.avgCompletionRate * 100)}%`}
            </span>
            <span className="mb-0.5 t-caption text-muted-foreground">of opened surveys were submitted</span>
          </div>
          <MeterRow
            label="Completion rate"
            value={Math.round((completion.avgCompletionRate ?? 0) * 100)}
            max={100}
            caption={completion.avgCompletionRate == null ? "no view data" : `${Math.round(completion.avgCompletionRate * 100)}%`}
          />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border/60 pt-3.5">
            <Fact label="Average time" value={formatDuration(completion.avgSecondsToComplete)} />
            <Fact label="Median time" value={formatDuration(completion.medianSecondsToComplete)} />
            <Fact label="Responses" value={String(completion.totalResponses)} />
            <Fact label="With timing" value={`${completion.responsesWithTiming}`} />
          </dl>
          {completion.responsesWithTiming < completion.totalResponses && (
            <p className="t-caption leading-relaxed text-tertiary">
              Timings cover {completion.responsesWithTiming} of {completion.totalResponses} responses — older
              submissions predate start-time capture.
            </p>
          )}
        </SectionPanel>

        {/* 4 · Language breakdown */}
        <SectionPanel title="Language" icon={Languages} className="lg:col-span-4">
          {languages.length === 0 ? (
            <EmptyState compact icon={Languages} title="No responses yet" description="Language mix appears once families begin submitting." />
          ) : (
            <div className="flex items-center gap-5">
              <div className="relative h-28 w-28 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={languages} dataKey="count" nameKey="label" innerRadius={36} outerRadius={54} paddingAngle={2} stroke="none">
                      {languages.map((l, i) => (
                        <Cell key={l.language} fill={i === 0 ? LANGUAGE_COLORS[0] : "hsl(var(--border-strong))"} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="t-card tabular-nums">{scoped.length}</span>
                </div>
              </div>
              <ul className="min-w-0 flex-1 space-y-2.5">
                {languages.map((l, i) => (
                  <li key={l.language}>
                    <div className="flex items-baseline justify-between gap-2 t-caption">
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-pill"
                          style={{ background: i === 0 ? LANGUAGE_COLORS[0] : "hsl(var(--border-strong))" }}
                        />
                        <span className="truncate text-muted-foreground">{l.label}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {l.count} · {Math.round(l.pct * 100)}%
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </SectionPanel>

        {/* 5 · Survey comparison */}
        <SectionPanel title="Survey comparison" icon={Table2} className="lg:col-span-8" bodyClassName="overflow-x-auto">
          <table className="w-full min-w-[38rem]">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="eyebrow pb-2 pr-3 font-semibold">Survey</th>
                <th className="eyebrow pb-2 pr-3 font-semibold">Status</th>
                <th className="eyebrow pb-2 pr-3 text-right font-semibold">Responses</th>
                <th className="eyebrow pb-2 pr-3 text-right font-semibold">Share</th>
                <th className="eyebrow pb-2 pr-3 text-right font-semibold">Completion</th>
                <th className="eyebrow pb-2 pr-3 text-right font-semibold">Avg time</th>
                <th className="eyebrow pb-2 text-right font-semibold">Last</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {comparison.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-sunken">
                  <td className="max-w-[14rem] py-2.5 pr-3">
                    <Link to={`/app/surveys/${c.id}/analytics`} className="flex items-center gap-1 truncate t-caption font-semibold hover:text-primary">
                      <span className="truncate">{c.title}</span>
                      <ArrowUpRight className="h-3 w-3 shrink-0 text-tertiary" strokeWidth={1.8} />
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3"><StatusBadge status={c.status} /></td>
                  <td className="py-2.5 pr-3 text-right t-caption font-semibold tabular-nums">{c.responses}</td>
                  <td className="py-2.5 pr-3 text-right t-caption tabular-nums text-muted-foreground">{Math.round(c.sharePct * 100)}%</td>
                  <td className="py-2.5 pr-3 text-right t-caption tabular-nums text-muted-foreground">
                    {c.completionRate == null ? "—" : `${Math.round(c.completionRate * 100)}%`}
                  </td>
                  <td className="py-2.5 pr-3 text-right t-caption tabular-nums text-muted-foreground">{formatDuration(c.avgSeconds)}</td>
                  <td className="py-2.5 text-right t-caption tabular-nums text-muted-foreground">
                    {c.lastResponseAt ? new Date(c.lastResponseAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionPanel>

        {/* 6 · Question statistics */}
        <SectionPanel
          title="Question statistics"
          icon={ListChecks}
          sub={selected ? selected.title : undefined}
          className="lg:col-span-7"
          action={
            surveyId !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setShowQuestions((v) => !v)}>
                {showQuestions ? "Hide" : "Analyse"}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showQuestions && "rotate-180")} strokeWidth={1.8} />
              </Button>
            )
          }
        >
          {surveyId === "all" ? (
            <EmptyState
              compact
              icon={ListChecks}
              title="Choose a survey"
              description="Question-level analysis runs against one instrument at a time — pick a survey above to see per-question findings."
            />
          ) : !showQuestions ? (
            <p className="py-6 text-center t-caption text-muted-foreground">
              Per-question breakdowns are computed on demand. Select <span className="font-semibold text-foreground">Analyse</span> to run them.
            </p>
          ) : questionsPending ? (
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-field" />)}
            </div>
          ) : !questionStats?.length ? (
            <EmptyState compact icon={ListChecks} title="Nothing to analyse" description="This survey has no countable questions — free-text answers are reviewed in the Responses workspace." />
          ) : (
            <ul className="thin-scrollbar max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
              {questionStats.map((q, i) => (
                <li key={q.id} className="rounded-field border border-border/60 px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 t-caption font-bold tabular-nums text-tertiary">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 t-caption font-medium leading-snug">{q.prompt}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 t-caption text-muted-foreground">
                        <span className="tabular-nums">{q.responseCount} answered</span>
                        {q.topLabel && (
                          <span className="truncate">
                            Top: <span className="font-medium text-foreground">{q.topLabel}</span> ({Math.round(q.topPct * 100)}%)
                          </span>
                        )}
                        {q.average != null && q.scaleMax && (
                          <span className="tabular-nums">
                            Mean <span className="font-semibold text-primary">{q.average.toFixed(2)}</span> / {q.scaleMax}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        {/* 7 · Instrument analytics */}
        <SectionPanel
          title="Instrument analytics"
          icon={Layers}
          className="lg:col-span-5"
          action={
            <Link to="/app/question-bank" className="t-caption font-medium text-primary hover:underline">
              Library
            </Link>
          }
        >
          {instrumentsPending ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-11 rounded-field" />)}
            </div>
          ) : !instruments?.length ? (
            <EmptyState compact icon={Layers} title="No instruments yet" description="Standardised instruments in the Question Library are compared here." />
          ) : (
            <ul className="thin-scrollbar max-h-[22rem] space-y-1.5 overflow-y-auto pr-1">
              {instruments.map((inst) => (
                <li key={inst.id} className="flex items-center gap-3 rounded-field border border-border/60 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate t-caption font-semibold">{inst.name}</span>
                      {inst.modified && (
                        <span
                          className="inline-flex shrink-0 items-center gap-0.5 t-caption text-warning"
                          title={`${inst.modifiedItems} question${inst.modifiedItems === 1 ? "" : "s"} differ from the published version`}
                        >
                          <ShieldAlert className="h-3 w-3" strokeWidth={1.9} />
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 t-caption text-tertiary">
                      {inst.itemCount} item{inst.itemCount === 1 ? "" : "s"}
                      {inst.source ? ` · ${inst.source}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="t-caption font-semibold tabular-nums">{inst.surveysUsing}</div>
                    <div className="t-caption text-tertiary">survey{inst.surveysUsing === 1 ? "" : "s"}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        {/* 8 · Exports */}
        <SectionPanel title="Export this analysis" icon={Download} className="lg:col-span-5" bodyClassName="space-y-2">
          <Button asChild variant="outline" className="w-full justify-start">
            <Link to={`/app/export${selected ? `?survey=${selected.id}` : ""}`}>
              <FileSpreadsheet strokeWidth={1.7} />
              Download workbook
              <span className="ml-auto t-caption text-tertiary">.xlsx</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full justify-start" disabled={!reportHref}>
            {reportHref ? (
              <Link to={reportHref} target="_blank">
                <FileText strokeWidth={1.7} />
                Open printable report
                <ExternalLink className="ml-auto h-3.5 w-3.5 text-tertiary" strokeWidth={1.7} />
              </Link>
            ) : (
              <span>Open printable report</span>
            )}
          </Button>
          <p className="pt-1 t-caption leading-relaxed text-tertiary">
            The workbook carries one row per response for statistical software; the printable report carries the
            summary and per-question breakdowns for the record.
          </p>
        </SectionPanel>

        {/* 9 · Recent generated reports */}
        <SectionPanel title="Recent reports" icon={FileText} className="lg:col-span-7">
          {history.length === 0 ? (
            <EmptyState
              compact
              icon={FileText}
              title="No reports generated yet."
              description="Workbooks and printable reports you generate are listed here for quick reference."
              primaryAction={
                <Button asChild size="sm" variant="outline">
                  <Link to="/app/export">Open Export Center</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2">
              {history.map((h, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-control",
                      h.format === "xlsx" ? "bg-[hsl(var(--success)/0.12)] text-success" : "bg-accent-tint text-primary",
                    )}
                  >
                    {h.format === "xlsx" ? <FileSpreadsheet className="h-4 w-4" strokeWidth={1.7} /> : <FileText className="h-4 w-4" strokeWidth={1.7} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate t-caption font-medium">{h.survey}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {h.format === "xlsx" ? "Workbook" : "Report"}
                      {h.count != null ? ` · ${h.count} responses` : ""} · {exportRelTime(h.at)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>
    </PageContainer>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 truncate t-caption font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ReportsSkeleton() {
  return (
    <PageContainer>
      <PageHeader eyebrow="Research analysis" title="Reports" subtitle="Trends, completion and question-level findings across the programme." />
      <div className="mt-6 grid gap-4 lg:grid-cols-12">
        <Skeleton className="h-44 rounded-surface lg:col-span-12" />
        <Skeleton className="h-80 rounded-surface lg:col-span-8" />
        <Skeleton className="h-80 rounded-surface lg:col-span-4" />
        <Skeleton className="h-64 rounded-surface lg:col-span-4" />
        <Skeleton className="h-64 rounded-surface lg:col-span-8" />
      </div>
    </PageContainer>
  );
}
