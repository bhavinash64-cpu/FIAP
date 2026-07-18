import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ClipboardList,
  Inbox,
  Activity,
  Plus,
  TrendingUp,
  QrCode,
  LayoutTemplate,
  Library,
  FileSearch,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { listSurveys } from "@/lib/surveys";
import { listBank } from "@/lib/questionBank";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/admin/PageContainer";
import { staggerParent, staggerChild } from "@/lib/motion";

interface Resp {
  id: string;
  survey_id: string;
  submitted_at: string;
}
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
  "bank.instrument.delete": "Library instrument removed",
  "bank.instrument.duplicate": "Library instrument duplicated",
  "bank.item.create": "Question added to library",
  "bank.item.revert": "Question reverted",
};

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

const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: "/app/surveys", label: "New survey", icon: Plus },
  { to: "/app/question-bank", label: "Question Library", icon: Library },
  { to: "/app/qr", label: "Share & QR", icon: QrCode },
  { to: "/app/response-explorer", label: "Responses", icon: FileSearch },
  { to: "/app/analytics", label: "Analytics", icon: TrendingUp },
  { to: "/app/reports", label: "Reports", icon: FileText },
];

export default function Overview() {
  const { data: surveys = [], isPending: surveysPending } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });
  const { data: bank = [] } = useQuery({ queryKey: ["question-bank"], queryFn: listBank });
  const { data: responses = [] } = useQuery({
    queryKey: ["overview-responses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("survey_responses")
        .select("id, survey_id, submitted_at")
        .order("submitted_at", { ascending: false })
        .limit(500);
      return (data ?? []) as Resp[];
    },
  });
  const { data: activity = [], isPending: activityPending } = useQuery({
    queryKey: ["overview-activity"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("action, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      return (data ?? []) as AuditRow[];
    },
  });

  const stats = useMemo(() => {
    const published = surveys.filter((s) => s.status === "published").length;
    const draft = surveys.filter((s) => s.status === "draft").length;
    const closed = surveys.filter((s) => s.status === "closed").length;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const today = responses.filter((r) => new Date(r.submitted_at) >= startToday).length;
    return {
      total: surveys.length,
      published,
      draft,
      closed,
      totalResponses: responses.length,
      today,
      bank: bank.reduce((n, i) => n + i.items.length, 0),
      instruments: bank.length,
      publishRate: surveys.length ? Math.round((published / surveys.length) * 100) : 0,
    };
  }, [surveys, responses, bank]);

  const chartData = useMemo(() => {
    const days = 14;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return { key: d.toISOString().slice(0, 10), count: 0 };
    });
    responses.forEach((r) => {
      const b = buckets.find((x) => x.key === r.submitted_at.slice(0, 10));
      if (b) b.count++;
    });
    return buckets;
  }, [responses]);

  const statusData = [
    { name: "Published", value: stats.published, color: "hsl(var(--primary))" },
    { name: "Draft", value: stats.draft, color: "hsl(var(--muted-foreground) / 0.45)" },
    { name: "Closed", value: stats.closed, color: "hsl(var(--foreground) / 0.22)" },
  ].filter((d) => d.value > 0);

  const recentSurveys = surveys.slice(0, 5);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <PageContainer className="lg:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="eyebrow text-primary">Overview · {today}</div>
          <h1 className="mt-1.5 t-title">
            Research that protects <span className="text-primary">tomorrow.</span>
          </h1>
        </div>
        <Button asChild>
          <Link to="/app/surveys">
            <Plus className="h-4 w-4" strokeWidth={1.5} /> New survey
          </Link>
        </Button>
      </div>

      {/* 12-col control-center grid. Primary column: hero KPI + supporting KPIs
          + primary chart. Rail: quick actions, status, recent activity. Recent
          surveys spans the bottom. Everything important lands above the fold on
          a common desktop; only the survey list can fall just below it. */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ── Primary column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:col-span-8">
          {/* Hero KPI + supporting KPIs */}
          <motion.div variants={staggerParent} initial="hidden" animate="show" className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <motion.div variants={staggerChild} className="card-premium relative col-span-2 overflow-hidden p-5 xl:col-span-2">
              <div className="glow-gradient pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-pill opacity-70" />
              <div className="relative">
                <div className="flex items-center gap-2 eyebrow text-muted-foreground">
                  <Inbox className="h-4 w-4" strokeWidth={1.6} /> Total responses
                </div>
                <div className="mt-2 flex items-end gap-3">
                  <span className="t-display leading-none tabular-nums">
                    <CountUp value={stats.totalResponses} />
                  </span>
                  {stats.today > 0 && (
                    <span className="mb-1.5 inline-flex items-center gap-1 rounded-pill bg-[hsl(var(--success)/0.12)] px-2 py-0.5 t-caption font-semibold text-success">
                      <TrendingUp className="h-3.5 w-3.5" strokeWidth={2} />+{stats.today} today
                    </span>
                  )}
                </div>
                <div className="mt-3 h-12 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#heroFill)" animationDuration={900} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-1 t-caption text-muted-foreground">Last 14 days</div>
              </div>
            </motion.div>

            <Kpi icon={ClipboardList} label="Active surveys" value={stats.published} sub={`${stats.total} total`} />
            <Kpi icon={TrendingUp} label="Publish rate" value={stats.publishRate} suffix="%" sub="of all surveys" />
          </motion.div>

          {/* Primary chart */}
          <Panel title="Responses over time" icon={Activity} sub="Last 14 days" className="min-h-0 flex-1">
            <div className="relative h-56 w-full xl:h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -26, bottom: 0 }}>
                  <defs>
                    <linearGradient id="respFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.26} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12, boxShadow: "var(--shadow-md)" }}
                    labelFormatter={() => ""}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#respFill)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
              {stats.totalResponses === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="rounded-pill bg-muted px-3 py-1 t-caption text-muted-foreground">
                    No responses yet — share a published survey to begin
                  </span>
                </div>
              )}
            </div>
          </Panel>
        </div>

        {/* ── Rail ───────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4 lg:col-span-4">
          <Panel title="Quick actions" icon={Plus}>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="group flex items-center gap-2.5 rounded-[12px] border border-border/70 px-3 py-2.5 transition-colors duration-fast hover:border-primary/40 hover:bg-muted/40"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-accent-tint text-primary transition-transform duration-fast group-hover:scale-105">
                    <a.icon className="h-4 w-4" strokeWidth={1.7} />
                  </span>
                  <span className="min-w-0 truncate t-caption font-medium">{a.label}</span>
                </Link>
              ))}
            </div>
          </Panel>

          <Panel title="Survey status" icon={ClipboardList}>
            <div className="flex items-center gap-5">
              <div className="relative h-20 w-20 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData.length ? statusData : [{ name: "none", value: 1, color: "hsl(var(--muted))" }]} dataKey="value" innerRadius={27} outerRadius={39} paddingAngle={2} stroke="none">
                      {(statusData.length ? statusData : [{ color: "hsl(var(--muted))" }]).map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="t-card leading-none tabular-nums">
                      <CountUp value={stats.total} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-1.5 t-caption">
                <Legend label="Published" value={stats.published} color="bg-primary" />
                <Legend label="Draft" value={stats.draft} color="bg-muted-foreground/45" />
                <Legend label="Closed" value={stats.closed} color="bg-foreground/22" />
              </div>
            </div>
          </Panel>

          <Panel title="Recent activity" icon={Activity} action={{ to: "/app/notifications", label: "View all" }} className="min-h-0 flex-1">
            {activityPending ? (
              <ul className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Skeleton className="h-1.5 w-1.5 shrink-0 rounded-pill" />
                    <Skeleton className="h-3.5 w-2/3" />
                  </li>
                ))}
              </ul>
            ) : activity.length === 0 ? (
              <p className="py-2 t-caption text-muted-foreground">Activity will appear here as it happens.</p>
            ) : (
              <ul className="space-y-2.5">
                {activity.slice(0, 6).map((a, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-pill bg-primary/70" />
                    <span className="min-w-0 flex-1 truncate t-caption font-medium">{ACTION_LABEL[a.action] ?? a.action}</span>
                    <span className="shrink-0 t-caption tabular-nums text-muted-foreground">{relTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* ── Recent surveys (spans; sits just at/below the fold) ─────── */}
        <div className="lg:col-span-12">
          <Panel title="Recent surveys" icon={ClipboardList} action={{ to: "/app/surveys", label: "View all" }}>
            {surveysPending ? (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-[12px]" />
                ))}
              </div>
            ) : recentSurveys.length === 0 ? (
              <div className="grid place-items-center rounded-[12px] border border-dashed border-border/70 px-4 py-8 text-center">
                <div>
                  <p className="t-body text-muted-foreground">No surveys yet.</p>
                  <Button asChild size="sm" variant="outline" className="mt-3">
                    <Link to="/app/surveys">New survey</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {recentSurveys.map((s) => (
                  <Link
                    key={s.id}
                    to={`/app/surveys/${s.id}/edit`}
                    className="group flex items-center gap-3 rounded-[12px] border border-border/70 px-3 py-2.5 transition-colors duration-fast hover:border-primary/40 hover:bg-muted/40"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent transition-transform duration-fast group-hover:scale-105">
                      <ClipboardList className="h-[17px] w-[17px] text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate t-caption font-semibold group-hover:text-primary">{s.title_en}</span>
                      <span className="block text-[11px] text-muted-foreground">{s.question_count} questions · {s.response_count} responses</span>
                    </span>
                    <StatusBadge status={s.status} />
                  </Link>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>
    </PageContainer>
  );
}

function Kpi({ icon: Icon, label, value, suffix, sub }: { icon: LucideIcon; label: string; value: number; suffix?: string; sub: string }) {
  return (
    <motion.div variants={staggerChild} className="card-premium flex flex-col justify-center p-5">
      <span className="grid h-8 w-8 place-items-center rounded-control bg-accent-tint text-primary">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
      </span>
      <div className="t-title mt-3 tabular-nums leading-none">
        <CountUp value={value} suffix={suffix} />
      </div>
      <div className="mt-1.5 t-caption font-medium">{label}</div>
      <div className="t-caption text-tertiary">{sub}</div>
    </motion.div>
  );
}

function Panel({
  title,
  icon: Icon,
  sub,
  action,
  className,
  children,
}: {
  title: string;
  icon: LucideIcon;
  sub?: string;
  action?: { to: string; label: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`card-premium p-5 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
        <h2 className="t-card">{title}</h2>
        {sub && <span className="t-caption text-muted-foreground">· {sub}</span>}
        {action && (
          <Link to={action.to} className="ml-auto t-caption font-medium text-primary hover:underline">
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Legend({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-pill ${color}`} />
      <span className="text-muted-foreground">{label}</span>
      <span className="ml-auto font-medium tabular-nums">{value}</span>
    </div>
  );
}
