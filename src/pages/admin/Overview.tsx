import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  ClipboardList,
  Inbox,
  Layers,
  Sparkles,
  Activity,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { INSTRUMENTS } from "@/lib/instruments";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/CountUp";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerParent, staggerChild } from "@/lib/motion";

interface Resp { id: string; survey_id: string; submitted_at: string }
interface AuditRow { action: string; created_at: string }

const ACTION_LABEL: Record<string, string> = {
  "survey.create": "Survey created",
  "survey.publish": "Survey published",
  "survey.close": "Survey closed",
  "survey.reopen": "Survey reopened",
  "survey.delete": "Survey deleted",
  "question.import.library": "Questions imported from library",
  "question.import.pdf": "Questions imported from PDF",
  "question.import.voice": "Question added by voice",
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

export default function Overview() {
  const [surveys, setSurveys] = useState<SurveyWithCounts[] | null>(null);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [activity, setActivity] = useState<AuditRow[]>([]);

  useEffect(() => {
    listSurveys().then(setSurveys).catch(() => setSurveys([]));
    supabase.from("survey_responses").select("id, survey_id, submitted_at").order("submitted_at", { ascending: false }).limit(500).then(({ data }) => setResponses(data ?? []));
    supabase.from("audit_logs").select("action, created_at").order("created_at", { ascending: false }).limit(12).then(({ data }) => setActivity((data ?? []) as AuditRow[]));
  }, []);

  const stats = useMemo(() => {
    const list = surveys ?? [];
    const published = list.filter((s) => s.status === "published").length;
    const draft = list.filter((s) => s.status === "draft").length;
    const closed = list.filter((s) => s.status === "closed").length;
    const bank = INSTRUMENTS.reduce((n, i) => n + i.items.length, 0);
    return {
      total: list.length,
      published,
      draft,
      closed,
      totalResponses: responses.length,
      bank,
      publishRate: list.length ? Math.round((published / list.length) * 100) : 0,
    };
  }, [surveys, responses]);

  const chartData = useMemo(() => {
    const days = 14;
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return { key: d.toISOString().slice(0, 10), label: d.toLocaleDateString(undefined, { day: "numeric" }), count: 0 };
    });
    responses.forEach((r) => {
      const b = buckets.find((x) => x.key === r.submitted_at.slice(0, 10));
      if (b) b.count++;
    });
    return buckets;
  }, [responses]);

  const statusData = [
    { name: "Published", value: stats.published, color: "hsl(var(--primary))" },
    { name: "Draft", value: stats.draft, color: "hsl(var(--muted-foreground) / 0.4)" },
    { name: "Closed", value: stats.closed, color: "hsl(var(--foreground) / 0.25)" },
  ].filter((d) => d.value > 0);

  const recentSurveys = (surveys ?? []).slice(0, 6);
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-4 px-6 py-6 lg:h-[calc(100dvh-3.5rem)] lg:overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow text-primary">Overview · {today}</div>
          <h1 className="t-title mt-2">
            Research that protects <span className="text-primary">tomorrow.</span>
          </h1>
        </div>
        <Button asChild><Link to="/app/surveys"><Plus className="h-4 w-4" strokeWidth={1.5} /> New survey</Link></Button>
      </div>

      {/* KPI cards */}
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={ClipboardList} tint="primary" label="Active surveys" value={stats.published} sub={`${stats.total} total`} />
        <Kpi icon={Inbox} tint="success" label="Total responses" value={stats.totalResponses} sub="all surveys" />
        <Kpi icon={Layers} tint="violet" label="Questions in bank" value={stats.bank} sub={`${INSTRUMENTS.length} instruments`} />
        <Kpi icon={TrendingUp} tint="amber" label="Publish rate" value={stats.publishRate} suffix="%" sub="of all surveys" />
      </motion.div>

      {/* Main grid — fills the remaining height, internal scroll only */}
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-3">
        {/* left — 2 cols */}
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-2">
          <Panel title="Responses over time" icon={Activity} sub="Last 14 days" className="shrink-0">
            <div className="relative h-[clamp(160px,26vh,240px)] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                  <defs>
                    <linearGradient id="respFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} interval={1} />
                  <YAxis tick={{ fontSize: 12, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }}
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12, boxShadow: "var(--shadow-md)" }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#respFill)" animationDuration={900} />
                </AreaChart>
              </ResponsiveContainer>
              {stats.totalResponses === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="rounded-pill bg-muted px-3 py-1 text-xs text-muted-foreground">No responses yet — share your published survey to begin</span>
                </div>
              )}
            </div>
          </Panel>

          <Panel title="Recent surveys" icon={ClipboardList} action={{ to: "/app/surveys", label: "View all" }} className="flex min-h-0 flex-1 flex-col" bodyClassName="min-h-0 flex-1">
            {surveys === null ? (
              <ul className="h-full space-y-2 overflow-hidden pr-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <li key={i} className="flex items-center gap-3 py-2">
                    <Skeleton className="h-9 w-9 shrink-0 rounded-control" />
                    <span className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : recentSurveys.length === 0 ? (
              <Empty text="No surveys yet." cta={{ to: "/app/surveys", label: "New survey" }} />
            ) : (
              <ul className="thin-scrollbar h-full space-y-0.5 overflow-y-auto pr-1">
                {recentSurveys.map((s) => (
                  <li key={s.id}>
                    <Link to={`/app/surveys/${s.id}/edit`} className="group -mx-2 flex items-center gap-3 rounded-control px-2 py-3 transition-all duration-200 hover:translate-x-0.5 hover:bg-muted/50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-accent transition-transform group-hover:scale-105"><ClipboardList className="h-[17px] w-[17px] text-primary" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold group-hover:text-primary">{s.title_en}</span>
                        <span className="text-xs text-muted-foreground">{s.question_count} questions · {s.response_count} responses</span>
                      </span>
                      <StatusBadge status={s.status} />
                      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* right col */}
        <div className="flex min-h-0 flex-col gap-4">
          <Panel title="Survey status" icon={Activity} className="shrink-0">
            <div className="flex items-center gap-6">
              <div className="relative h-24 w-24 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusData.length ? statusData : [{ name: "none", value: 1, color: "hsl(var(--muted))" }]} dataKey="value" innerRadius={32} outerRadius={46} paddingAngle={2} stroke="none">
                      {(statusData.length ? statusData : [{ color: "hsl(var(--muted))" }]).map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 grid place-items-center">
                  <div className="text-center">
                    <div className="text-lg font-semibold leading-none tabular-nums"><CountUp value={stats.total} /></div>
                    <div className="t-caption text-muted-foreground">surveys</div>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2 text-sm">
                <Legend label="Published" value={stats.published} color="bg-primary" />
                <Legend label="Draft" value={stats.draft} color="bg-muted-foreground/40" />
                <Legend label="Closed" value={stats.closed} color="bg-foreground/25" />
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2.5 rounded-control bg-accent/60 px-3 py-3">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="t-caption leading-snug">
                {stats.totalResponses === 0
                  ? `${stats.bank} validated questions ready to add from the library.`
                  : `${stats.totalResponses} responses across ${stats.published} live survey${stats.published === 1 ? "" : "s"}.`}
              </span>
            </div>
          </Panel>

          <Panel title="Recent activity" icon={Activity} className="flex min-h-0 flex-1 flex-col" bodyClassName="min-h-0 flex-1">
            {activity.length === 0 ? (
              <Empty text="Every administrative action is recorded here." />
            ) : (
              <ul className="thin-scrollbar h-full space-y-3 overflow-y-auto pr-1">
                {activity.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-primary/70" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate t-caption font-medium">{ACTION_LABEL[a.action] ?? a.action}</div>
                      <div className="t-caption text-muted-foreground">{relTime(a.created_at)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

// One accent only — the icon well is always the indigo lavender wash.
const TINTS: Record<string, string> = {
  primary: "bg-accent-tint text-primary",
  success: "bg-accent-tint text-primary",
  violet: "bg-accent-tint text-primary",
  amber: "bg-accent-tint text-primary",
};

function Kpi({ icon: Icon, tint, label, value, suffix, sub }: { icon: typeof Layers; tint: string; label: string; value: number; suffix?: string; sub: string }) {
  return (
    <motion.div variants={staggerChild} className="card-premium card-premium-hover p-4">
      <span className={`grid h-9 w-9 place-items-center rounded-control ${TINTS[tint]}`}><Icon className="h-[18px] w-[18px]" strokeWidth={1.5} /></span>
      <div className="t-section mt-3 tabular-nums"><CountUp value={value} suffix={suffix} /></div>
      <div className="mt-1 t-caption font-medium">{label}</div>
      <div className="t-caption text-tertiary">{sub}</div>
    </motion.div>
  );
}

function Panel({ title, icon: Icon, sub, action, className, bodyClassName, children }: { title: string; icon: typeof Activity; sub?: string; action?: { to: string; label: string }; className?: string; bodyClassName?: string; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className={`card-premium p-6 ${className ?? ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{title}</h2>
        {sub && <span className="text-xs text-muted-foreground">· {sub}</span>}
        {action && <Link to={action.to} className="ml-auto text-xs font-medium text-primary hover:underline">{action.label}</Link>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </motion.section>
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

function Empty({ text, cta }: { text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="grid h-full place-items-center rounded-control border border-dashed border-border/70 px-4 py-6 text-center">
      <div>
        <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">{text}</p>
        {cta && <Button asChild size="sm" variant="outline" className="mt-3 rounded-control"><Link to={cta.to}>{cta.label}</Link></Button>}
      </div>
    </div>
  );
}
