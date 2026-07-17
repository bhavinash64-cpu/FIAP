import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FileBarChart2, FileText, Loader2, TrendingUp, TrendingDown, Minus, Inbox, ClipboardList, CalendarDays, Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { getPeriodComparison, type Period, type PeriodComparison } from "@/lib/analytics";
import { CountUp } from "@/components/CountUp";
import { staggerParent, staggerChild } from "@/lib/motion";

const PERIOD_LABEL: Record<Period, { current: string; previous: string }> = {
  week: { current: "This week", previous: "last week" },
  month: { current: "This month", previous: "last month" },
  year: { current: "This year", previous: "last year" },
};

export default function Reports() {
  const [surveys, setSurveys] = useState<SurveyWithCounts[] | null>(null);
  const [surveyId, setSurveyId] = useState<string>("");
  const [period, setPeriod] = useState<Period>("week");
  const [comparison, setComparison] = useState<PeriodComparison | null>(null);

  useEffect(() => {
    listSurveys().then((s) => {
      setSurveys(s);
      if (s.length) setSurveyId(s[0].id);
    });
  }, []);

  useEffect(() => {
    if (!surveyId) return;
    setComparison(null);
    getPeriodComparison(surveyId, period).then(setComparison);
  }, [surveyId, period]);

  const selected = surveys?.find((s) => s.id === surveyId);
  const labels = PERIOD_LABEL[period];
  const up = (comparison?.pctChange ?? 0) >= 0;
  const TrendIcon = comparison?.pctChange == null ? Minus : up ? TrendingUp : TrendingDown;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8">
      {/* Header + toolbar in one full-width band */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow">Reports</div>
          <h1 className="t-title mt-2">Weekly, monthly &amp; yearly</h1>
          <p className="t-body text-muted-foreground mt-2 max-w-xl">Period-over-period response trends, ready to export for official review.</p>
        </div>
        {surveys && surveys.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={surveyId} onValueChange={setSurveyId}>
              <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="Choose a survey" /></SelectTrigger>
              <SelectContent>
                {surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.title_en}</SelectItem>)}
              </SelectContent>
            </Select>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="rounded-control bg-sunken">
                <TabsTrigger value="week" className="rounded-control">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="rounded-control">Monthly</TabsTrigger>
                <TabsTrigger value="year" className="rounded-control">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
            {selected && (
              <Button asChild variant="outline">
                <Link to={`/app/surveys/${selected.id}/report?range=${period}`} target="_blank">
                  <FileText strokeWidth={1.5} />Export PDF
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {surveys === null ? (
        <div className="grid place-items-center py-24"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} /></div>
      ) : surveys.length === 0 ? (
        <Card className="mt-8 flex flex-col items-center px-6 py-24 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <FileBarChart2 className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <h2 className="t-section mt-6">No surveys yet</h2>
          <p className="t-body text-muted-foreground mt-2 max-w-sm">Create a survey first — reports will appear here once it has responses.</p>
          <Button asChild className="mt-8">
            <Link to="/app/surveys"><Plus strokeWidth={1.5} />New survey</Link>
          </Button>
        </Card>
      ) : (
        <motion.div
          key={surveyId + period}
          variants={staggerParent}
          initial="hidden"
          animate="show"
          className="mt-6 grid gap-4 lg:grid-cols-3"
        >
          {/* Hero period card spans two columns so it fills the width */}
          <motion.div variants={staggerChild} className="lg:col-span-2">
            <Card className="relative overflow-hidden p-6">
              <div className="glow-gradient pointer-events-none absolute -right-8 -top-8 h-56 w-56 rounded-pill opacity-70" />
              <div className="relative">
                <div className="flex items-center gap-2 t-caption text-muted-foreground">
                  <CalendarDays className="h-4 w-4" strokeWidth={1.5} /> {labels.current} · {selected?.title_en}
                </div>
                {comparison === null ? (
                  <div className="flex h-40 items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} /></div>
                ) : (
                  <>
                    <div className="mt-4 flex items-end gap-4">
                      <CountUp value={comparison.current} className="t-hero tabular-nums" />
                      <Badge variant={comparison.pctChange == null ? "secondary" : up ? "success" : "danger"} className="mb-2">
                        <TrendIcon className="h-3.5 w-3.5" strokeWidth={1.5} />
                        {comparison.pctChange == null ? "new" : `${up ? "+" : ""}${Math.round(comparison.pctChange)}%`}
                      </Badge>
                    </div>
                    <div className="mt-2 t-caption text-muted-foreground">
                      new responses this period · <span className="font-semibold text-foreground tabular-nums">{comparison.previous}</span> {labels.previous}
                    </div>
                    {/* comparison bar */}
                    <div className="mt-6 space-y-3">
                      <Bar label={labels.current} value={comparison.current} max={Math.max(comparison.current, comparison.previous, 1)} tone="primary" />
                      <Bar label={`Previous ${period}`} value={comparison.previous} max={Math.max(comparison.current, comparison.previous, 1)} tone="muted" />
                    </div>
                  </>
                )}
              </div>
            </Card>
          </motion.div>

          {/* Right column — a single card of list-rows, not three separate tiles */}
          <motion.div variants={staggerChild} className="content-start">
            <Card className="divide-y divide-border">
              <StatRow icon={Inbox} label="Total responses" value={selected?.response_count ?? 0} sub="all time" />
              <StatRow icon={ClipboardList} label="Questions" value={selected?.question_count ?? 0} sub="in this survey" />
              <div className="flex items-center justify-between gap-4 px-8 py-6 transition-colors duration-base hover:bg-sunken">
                <div className="flex items-center gap-4 min-w-0">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-muted-foreground">
                    <Activity className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0">
                    <div className="t-card">Status</div>
                    <div className="t-caption text-muted-foreground">current state</div>
                  </div>
                </div>
                {selected && <StatusBadge status={selected.status} />}
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "primary" | "muted" }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between t-caption">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground tabular-nums">{value}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-pill bg-sunken">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={tone === "primary" ? "h-full rounded-pill bg-primary" : "h-full rounded-pill bg-border-strong"}
        />
      </div>
    </div>
  );
}

function StatRow({ icon: Icon, label, value, sub }: { icon: typeof Inbox; label: string; value: number; sub: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 py-6 transition-colors duration-base hover:bg-sunken">
      <div className="flex items-center gap-4 min-w-0">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-sunken text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <div className="min-w-0">
          <div className="t-card truncate">{label}</div>
          <div className="t-caption text-muted-foreground">{sub}</div>
        </div>
      </div>
      <CountUp value={value} className="t-section tabular-nums shrink-0" />
    </div>
  );
}
