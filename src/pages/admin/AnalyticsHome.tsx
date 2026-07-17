import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { BarChart3, ArrowUpRight, Users, ClipboardList, TrendingUp } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { CountUp } from "@/components/CountUp";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerParent, staggerChild } from "@/lib/motion";

export default function AnalyticsHome() {
  const [surveys, setSurveys] = useState<SurveyWithCounts[] | null>(null);

  useEffect(() => {
    listSurveys().then(setSurveys).catch(() => setSurveys([]));
  }, []);

  const stats = useMemo(() => {
    const list = surveys ?? [];
    return {
      total: list.length,
      responses: list.reduce((n, s) => n + s.response_count, 0),
      questions: list.reduce((n, s) => n + s.question_count, 0),
      published: list.filter((s) => s.status === "published").length,
    };
  }, [surveys]);

  const chartData = (surveys ?? [])
    .map((s) => ({ name: s.title_en.length > 18 ? s.title_en.slice(0, 17) + "…" : s.title_en, responses: s.response_count }))
    .slice(0, 8);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8">
      <header>
        <div className="eyebrow text-primary">Insight</div>
        <h1 className="t-title mt-2">Analytics</h1>
        <p className="t-body mt-3 max-w-xl text-muted-foreground">Response trends, per-question breakdowns and text-answer review — open any survey for the full dashboard.</p>
      </header>

      {/* Summary */}
      <motion.div variants={staggerParent} initial="hidden" animate="show" className="mt-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
        <Summary icon={ClipboardList} label="Surveys" value={stats.total} sub={`${stats.published} live`} />
        <Summary icon={Users} label="Responses" value={stats.responses} sub="all time" />
        <Summary icon={BarChart3} label="Questions" value={stats.questions} sub="across surveys" />
        <Summary icon={TrendingUp} label="Avg / survey" value={stats.total ? Math.round(stats.responses / stats.total) : 0} sub="responses" />
      </motion.div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center gap-3">
            <BarChart3 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
            <CardTitle>Responses by survey</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData.length ? chartData : [{ name: "—", responses: 0 }]} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 13, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 13, fill: "hsl(var(--text-tertiary))" }} axisLine={false} tickLine={false} allowDecimals={false} width={34} />
                  <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.5)" }} contentStyle={{ borderRadius: 14, border: "1px solid hsl(var(--border))", fontSize: 13, boxShadow: "var(--shadow-md)" }} />
                  <Bar dataKey="responses" radius={[8, 8, 0, 0]} animationDuration={800}>
                    {(chartData.length ? chartData : [{}]).map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {stats.responses === 0 && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <span className="rounded-pill bg-muted px-3 py-1 t-caption text-muted-foreground">No responses yet</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Survey picker list */}
        <Card className="flex flex-col">
          <CardHeader><CardTitle>Open a dashboard</CardTitle></CardHeader>
          <CardContent className="flex flex-1 flex-col">
            {surveys === null ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-control" />)}</div>
            ) : surveys.length === 0 ? (
              <p className="t-body py-8 text-center text-muted-foreground">Publish a survey to unlock analytics.</p>
            ) : (
              <div className="thin-scrollbar -mr-2 max-h-[15rem] space-y-1 overflow-y-auto pr-2">
                {surveys.map((s) => (
                  <Link key={s.id} to={`/app/surveys/${s.id}/analytics`} className="group flex items-center gap-3 rounded-control px-3 py-4 transition-colors duration-base ease-out hover:bg-sunken">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate t-caption font-semibold text-foreground group-hover:text-primary">{s.title_en}</span>
                      <span className="block t-caption text-muted-foreground">{s.response_count} responses</span>
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-base ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.5} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Full cards */}
      {surveys && surveys.length > 0 && (
        <motion.div variants={staggerParent} initial="hidden" animate="show" className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {surveys.map((s) => (
            <motion.div key={s.id} variants={staggerChild}>
              <Card className="h-full transition-[transform,box-shadow] duration-base ease-out hover:-translate-y-[2px] hover:shadow-md">
                <Link to={`/app/surveys/${s.id}/analytics`} className="flex h-full flex-col p-6">
                  <div className="flex items-start justify-between">
                    <StatusBadge status={s.status} />
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <div className="mt-4 line-clamp-2 t-card leading-snug">{s.title_en}</div>
                  <div className="mt-auto flex items-center gap-4 pt-4 t-caption text-muted-foreground">
                    <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" strokeWidth={1.5} />{s.question_count}</span>
                    <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" strokeWidth={1.5} />{s.response_count}</span>
                  </div>
                </Link>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
}

function Summary({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: number; sub: string }) {
  return (
    <motion.div variants={staggerChild}>
      <Card className="p-6">
        <span className="grid h-9 w-9 place-items-center rounded-control bg-primary-tint text-primary"><Icon className="h-[18px] w-[18px]" strokeWidth={1.5} /></span>
        <div className="mt-4 t-title tabular-nums leading-none"><CountUp value={value} /></div>
        <div className="mt-3 t-caption font-medium text-foreground">{label}</div>
        <div className="t-caption text-muted-foreground">{sub}</div>
      </Card>
    </motion.div>
  );
}
