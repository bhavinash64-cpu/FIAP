import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Activity,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  Inbox,
  Languages,
  Plus,
  QrCode,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { listSurveys } from "@/lib/surveys";
import { getSurveyResponseSummaries, listResponses } from "@/lib/responseExplorer";
import {
  buildCompletionStats,
  buildLanguageBreakdown,
  buildTrend,
  formatDuration,
  periodOverPeriod,
  type TrendPeriod,
} from "@/lib/reports";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/admin/PageContainer";
import { MeterRow, SectionPanel } from "@/components/admin/SectionPanel";
import { StatTile } from "@/components/admin/StatTile";
import { staggerChild, staggerParent } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * The Dashboard: what is running, what arrived, and how it is going — in ONE
 * screen.
 *
 * The constraint that shapes every decision below is that this page must fit a
 * 1440x900 viewport with at most a nudge of scroll. A dashboard you have to
 * scroll is a report, and the moment it needs scrolling people stop reading the
 * bottom half, which is exactly where the previous version had put the two
 * lists that answer "what just happened".
 *
 * So density comes from removing duplication, not from shrinking type:
 *  - The old page drew the SAME 14-day series twice — once as a sparkline in
 *    the hero tile and again as a full panel directly beneath it. One chart.
 *  - Six quick-action cards became a single row of buttons. They are shortcuts
 *    to places already in the sidebar; they do not need to be the largest
 *    objects on the screen.
 *  - The survey-status donut was a chart with three data points. It is three
 *    numbers, so it is now three numbers.
 * What that bought is the space to bring the analytics an administrator
 * actually opens Reports for — trend, completion, timing, language mix — onto
 * the first screen they see.
 */

interface AuditRow {
  action: string;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  "survey.create": "Survey created",
  "survey.publish": "Survey published",
  "survey.close": "Survey closed",
  "survey.reopen": "Survey reopened",
  "survey.delete": "Survey deleted",
  "question.import.library": "Questions imported",
  "question.import.pdf": "Questions imported from PDF",
  "question.import.voice": "Question added by voice",
  "bank.instrument.create": "Library instrument added",
  "bank.item.create": "Question added to library",
  "family_case.create": "Family case created",
  "family_case.pin_regenerate": "PIN regenerated",
  "family_case.link_regenerate": "Link regenerated",
  "family_case.reopen": "Family case reopened",
};

const PERIODS: { value: TrendPeriod; label: string }[] = [
  { value: "week", label: "7d" },
  { value: "month", label: "30d" },
  { value: "year", label: "12m" },
];

/** Shortcuts, not destinations — the sidebar already owns navigation. */
const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/surveys", label: "New survey", icon: Plus },
  { to: "/app/families", label: "Families", icon: Users },
  { to: "/app/qr", label: "Share & QR", icon: QrCode },
  { to: "/app/responses", label: "Export", icon: Download },
  { to: "/app/reports", label: "Reports", icon: FileText },
];

function relTime(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export default function Overview() {
  const [period, setPeriod] = useState<TrendPeriod>("month");

  const { data: surveys = [], isPending: surveysPending } = useQuery({
    queryKey: ["surveys"],
    queryFn: listSurveys,
  });

  // The same ["all-responses"] cache the Responses workspace and Reports read,
  // so moving between them is instant. An errored fetch must surface as an
  // error — rendering it as "0 responses" reads as a healthy but empty account.
  const {
    data: responses = [],
    isError: responsesError,
    isPending: responsesPending,
  } = useQuery({ queryKey: ["all-responses"], queryFn: listResponses });

  const { data: summaries = [] } = useQuery({
    queryKey: ["survey-response-summaries"],
    queryFn: getSurveyResponseSummaries,
  });

  const { data: activity = [], isPending: activityPending } = useQuery({
    queryKey: ["overview-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("action, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const stats = useMemo(() => {
    const published = surveys.filter((s) => s.status === "published").length;
    const draft = surveys.filter((s) => s.status === "draft").length;
    const closed = surveys.filter((s) => s.status === "closed").length;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const today = responses.filter((r) => new Date(r.submittedAt) >= startToday).length;
    return { total: surveys.length, published, draft, closed, totalResponses: responses.length, today };
  }, [surveys, responses]);

  const trend = useMemo(() => buildTrend(responses, period), [responses, period]);
  const delta = useMemo(() => periodOverPeriod(responses, period), [responses, period]);
  const completion = useMemo(() => buildCompletionStats(responses, summaries), [responses, summaries]);
  const languages = useMemo(() => buildLanguageBreakdown(responses), [responses]);

  const latestResponses = responses.slice(0, 5);
  const recentSurveys = surveys.slice(0, 5);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const trendDirection = delta.pctChange == null ? "flat" : delta.pctChange > 0 ? "up" : delta.pctChange < 0 ? "down" : "flat";

  return (
    <PageContainer className="lg:py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow text-primary">Overview · {today}</div>
          <h1 className="mt-1 t-title">
            Research that protects <span className="text-primary">tomorrow.</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_ACTIONS.map((a) => (
            <Button key={a.to} asChild variant={a.to === "/app/surveys" ? "default" : "outline"} size="sm" className="h-9">
              <Link to={a.to}>
                <a.icon className="h-4 w-4" strokeWidth={1.7} />
                {a.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <motion.div
        variants={staggerParent}
        initial="hidden"
        animate="show"
        className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5"
      >
        <motion.div variants={staggerChild}>
          <StatTile
            icon={Inbox}
            label="Total responses"
            value={responsesError ? "—" : stats.totalResponses}
            sub={responsesError ? "couldn't load — reload to retry" : `+${stats.today} today`}
            tone="primary"
            loading={responsesPending}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={staggerChild}>
          <StatTile
            icon={TrendingUp}
            label={`This ${period === "week" ? "week" : period === "month" ? "month" : "year"}`}
            value={delta.current}
            sub={delta.pctChange == null ? "no prior period" : `vs ${delta.previous} before`}
            trend={{ value: delta.pctChange ?? 0, direction: trendDirection }}
            loading={responsesPending}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={staggerChild}>
          <StatTile
            icon={ClipboardList}
            label="Active surveys"
            value={stats.published}
            sub={`${stats.draft} draft · ${stats.closed} closed`}
            loading={surveysPending}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={staggerChild}>
          <StatTile
            icon={Gauge}
            label="Completion"
            value={completion.avgCompletionRate == null ? "—" : `${Math.round(completion.avgCompletionRate * 100)}%`}
            sub={completion.avgCompletionRate == null ? "no view data yet" : "of opens submitted"}
            loading={responsesPending}
            className="h-full"
          />
        </motion.div>
        <motion.div variants={staggerChild}>
          <StatTile
            icon={Activity}
            label="Median time"
            value={formatDuration(completion.medianSecondsToComplete)}
            /* The honesty figure. An average drawn from three timed sessions out
               of four hundred is not a median of anything, and saying so is
               cheaper than having someone quote it in a paper. */
            sub={`from ${completion.responsesWithTiming} timed`}
            loading={responsesPending}
            className="h-full"
          />
        </motion.div>
      </motion.div>

      {/* ── Analytics band ───────────────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <SectionPanel
          title="Responses over time"
          icon={Activity}
          className="lg:col-span-8"
          action={
            <div className="flex items-center gap-0.5 rounded-pill bg-sunken p-0.5">
              {PERIODS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  aria-pressed={period === p.value}
                  className={cn(
                    "rounded-pill px-2.5 py-1 t-caption font-semibold transition-colors duration-fast",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    period === p.value ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="relative h-[188px] w-full">
            {responsesPending ? (
              <Skeleton className="h-full w-full rounded-field" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 4, left: -28, bottom: 0 }}>
                  <defs>
                    <linearGradient id="respFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid hsl(var(--border))",
                      fontSize: 12,
                      boxShadow: "var(--shadow-md)",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    name="Responses"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    fill="url(#respFill)"
                    animationDuration={700}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            {!responsesPending && stats.totalResponses === 0 && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="rounded-pill bg-muted px-3 py-1 t-caption text-muted-foreground">
                  No responses yet — enrol a family to begin
                </span>
              </div>
            )}
          </div>
        </SectionPanel>

        <SectionPanel title="Breakdown" icon={Languages} className="lg:col-span-4">
          <div className="space-y-3.5">
            {responsesPending ? (
              Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)
            ) : stats.totalResponses === 0 ? (
              <p className="t-caption text-muted-foreground">
                Language and completion shares appear once the first assessment is submitted.
              </p>
            ) : (
              <>
                {languages.map((l) => (
                  <MeterRow
                    key={l.language}
                    label={l.label}
                    value={l.count}
                    max={stats.totalResponses}
                    caption={`${l.count} · ${Math.round(l.pct * 100)}%`}
                  />
                ))}
                <MeterRow
                  label="Timed sessions"
                  value={completion.responsesWithTiming}
                  max={stats.totalResponses}
                  caption={`${completion.responsesWithTiming} / ${stats.totalResponses}`}
                  tone="muted"
                />
                <div className="flex items-center justify-between border-t border-border/70 pt-2.5 t-caption">
                  <span className="text-muted-foreground">Average time</span>
                  <span className="font-semibold tabular-nums">
                    {formatDuration(completion.avgSecondsToComplete)}
                  </span>
                </div>
              </>
            )}
          </div>
        </SectionPanel>
      </div>

      {/* ── What just happened ───────────────────────────────────────────── */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-12">
        <SectionPanel
          title="Latest responses"
          icon={Inbox}
          className="lg:col-span-5"
          action={
            <Link to="/app/responses" className="t-caption font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {responsesPending ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-field" />
              ))}
            </div>
          ) : latestResponses.length === 0 ? (
            <EmptyRow label="No responses yet." to="/app/families" action="Enrol a family" />
          ) : (
            <ul className="space-y-1">
              {latestResponses.map((r) => (
                <li key={r.id}>
                  {/* Opens straight into the workspace inspector — the id is
                      consumed and dropped from the URL by Responses. */}
                  <Link
                    to={`/app/responses?r=${r.id}`}
                    className="group flex items-center gap-3 rounded-field border border-border/70 px-3 py-1.5 transition-colors duration-fast hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span className="shrink-0 font-mono text-xs font-semibold tracking-wide group-hover:text-primary">
                      {r.referenceId}
                    </span>
                    <span className="min-w-0 flex-1 truncate t-caption text-muted-foreground">{r.surveyTitle}</span>
                    <span className="shrink-0 t-caption tabular-nums text-tertiary">{relTime(r.submittedAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel
          title="Recent surveys"
          icon={ClipboardList}
          className="lg:col-span-4"
          action={
            <Link to="/app/surveys" className="t-caption font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          {surveysPending ? (
            <div className="space-y-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 rounded-field" />
              ))}
            </div>
          ) : recentSurveys.length === 0 ? (
            <EmptyRow label="No surveys yet." to="/app/surveys" action="New survey" />
          ) : (
            <ul className="space-y-1">
              {recentSurveys.map((s) => (
                <li key={s.id}>
                  <Link
                    to={`/app/surveys/${s.id}/edit`}
                    className="group flex items-center gap-2.5 rounded-field border border-border/70 px-3 py-1.5 transition-colors duration-fast hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1 truncate t-caption font-semibold group-hover:text-primary">
                      {s.title_en}
                    </span>
                    <span className="shrink-0 t-caption tabular-nums text-tertiary">{s.response_count}</span>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>

        <SectionPanel title="Activity" icon={Activity} className="lg:col-span-3">
          {activityPending ? (
            <ul className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-pill" />
                  <Skeleton className="h-3 w-2/3" />
                </li>
              ))}
            </ul>
          ) : activity.length === 0 ? (
            <p className="t-caption text-muted-foreground">Activity will appear here as it happens.</p>
          ) : (
            <ul className="space-y-2">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-primary/70" />
                  <span className="min-w-0 flex-1 truncate t-caption font-medium">
                    {ACTION_LABEL[a.action] ?? a.action}
                  </span>
                  <span className="shrink-0 t-caption tabular-nums text-tertiary">{relTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </SectionPanel>
      </div>
    </PageContainer>
  );
}

function EmptyRow({ label, to, action }: { label: string; to: string; action: string }) {
  return (
    <div className="grid place-items-center rounded-field border border-dashed border-border/70 px-4 py-5 text-center">
      <div>
        <p className="t-caption text-muted-foreground">{label}</p>
        <Button asChild size="sm" variant="outline" className="mt-2">
          <Link to={to}>{action}</Link>
        </Button>
      </div>
    </div>
  );
}
