import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { FileBarChart2, FileText, Loader2, TrendingUp, TrendingDown, Minus, Inbox, ClipboardList, Activity, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { listSurveys } from "@/lib/surveys";
import { getPeriodComparison, type Period } from "@/lib/analytics";
import { CountUp } from "@/components/CountUp";

const PERIOD_LABEL: Record<Period, { current: string; previous: string; noun: string }> = {
  week: { current: "This week", previous: "last week", noun: "week" },
  month: { current: "This month", previous: "last month", noun: "month" },
  year: { current: "This year", previous: "last year", noun: "year" },
};

export default function Reports() {
  const [surveyId, setSurveyId] = useState<string>("");
  const [period, setPeriod] = useState<Period>("week");

  const { data: surveys, isPending } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });

  useEffect(() => {
    if (surveys?.length && !surveys.some((s) => s.id === surveyId)) setSurveyId(surveys[0].id);
  }, [surveys, surveyId]);

  const { data: comparison } = useQuery({
    queryKey: ["period-comparison", surveyId, period],
    queryFn: () => getPeriodComparison(surveyId, period),
    enabled: !!surveyId,
  });

  const selected = surveys?.find((s) => s.id === surveyId);
  const labels = PERIOD_LABEL[period];
  const up = (comparison?.pctChange ?? 0) >= 0;
  const TrendIcon = comparison?.pctChange == null ? Minus : up ? TrendingUp : TrendingDown;

  // The one-line takeaway — an executive summary leads with the conclusion.
  const insight = (() => {
    if (!comparison) return "";
    const { current, previous, pctChange } = comparison;
    if (current === 0 && previous === 0) return `No responses have been recorded ${labels.current.toLowerCase()} yet.`;
    if (pctChange == null) return `${current} response${current === 1 ? "" : "s"} arrived ${labels.current.toLowerCase()} — the first on record for this period.`;
    const dir = up ? "up" : "down";
    return `Responses are ${dir} ${Math.abs(Math.round(pctChange))}% versus ${labels.previous}, with ${current} this ${labels.noun} against ${previous} before.`;
  })();

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Executive summary"
        title="Reports"
        subtitle="Period-over-period response trends, ready to share for official review."
        actions={
          surveys && surveys.length > 0 ? (
            <>
              <Select value={surveyId} onValueChange={setSurveyId}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Choose a survey" />
                </SelectTrigger>
                <SelectContent>
                  {surveys.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.title_en}
                    </SelectItem>
                  ))}
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
                    <FileText strokeWidth={1.5} />
                    Export PDF
                  </Link>
                </Button>
              )}
            </>
          ) : null
        }
      />

      {isPending ? (
        <div className="grid place-items-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
        </div>
      ) : !surveys?.length ? (
        <div className="mt-8 flex flex-col items-center rounded-surface border border-dashed border-border px-6 py-24 text-center">
          <div className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <FileBarChart2 className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">No reports yet</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
            Create and publish a survey — once it collects responses, its weekly, monthly and yearly summaries appear here.
          </p>
          <Button asChild className="mt-8">
            <Link to="/app/surveys">
              <Plus strokeWidth={1.5} />
              New survey
            </Link>
          </Button>
        </div>
      ) : (
        <motion.div
          key={surveyId + period}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="mt-6 grid gap-4 lg:grid-cols-3"
        >
          {/* Lead — headline metric + the plain-language takeaway */}
          <div className="lg:col-span-2">
            <div className="relative overflow-hidden rounded-surface border border-border/70 bg-card p-6 sm:p-8">
              <div className="glow-gradient pointer-events-none absolute -right-8 -top-8 h-56 w-56 rounded-pill opacity-70" />
              <div className="relative">
                <div className="eyebrow text-primary">
                  {labels.current} · {selected?.title_en}
                </div>
                {!comparison ? (
                  <div className="flex h-44 items-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" strokeWidth={1.5} />
                  </div>
                ) : (
                  <>
                    <div className="mt-4 flex items-end gap-4">
                      <span className="t-display leading-none tabular-nums">
                        <CountUp value={comparison.current} />
                      </span>
                      <Badge variant={comparison.pctChange == null ? "secondary" : up ? "success" : "danger"} className="mb-2.5">
                        <TrendIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
                        {comparison.pctChange == null ? "new" : `${up ? "+" : ""}${Math.round(comparison.pctChange)}%`}
                      </Badge>
                    </div>
                    <div className="mt-1 t-caption text-muted-foreground">new responses this {labels.noun}</div>

                    <p className="mt-6 max-w-xl t-section font-normal leading-snug text-balance">{insight}</p>

                    <div className="mt-7 space-y-3">
                      <Bar label={labels.current} value={comparison.current} max={Math.max(comparison.current, comparison.previous, 1)} tone="primary" />
                      <Bar label={`Previous ${labels.noun}`} value={comparison.previous} max={Math.max(comparison.current, comparison.previous, 1)} tone="muted" />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Supporting metrics */}
          <div>
            <div className="overflow-hidden rounded-surface border border-border/70 bg-card">
              <StatRow icon={Inbox} label="Total responses" value={selected?.response_count ?? 0} sub="all time" />
              <StatRow icon={ClipboardList} label="Questions" value={selected?.question_count ?? 0} sub="in this survey" divided />
              <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-5">
                <div className="flex min-w-0 items-center gap-3.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-sunken text-muted-foreground">
                    <Activity className="h-[18px] w-[18px]" strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0">
                    <div className="t-card">Status</div>
                    <div className="t-caption text-muted-foreground">current state</div>
                  </div>
                </div>
                {selected && <StatusBadge status={selected.status} />}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </PageContainer>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "primary" | "muted" }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between t-caption">
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

function StatRow({ icon: Icon, label, value, sub, divided }: { icon: typeof Inbox; label: string; value: number; sub: string; divided?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-4 px-6 py-5 ${divided ? "border-t border-border" : ""}`}>
      <div className="flex min-w-0 items-center gap-3.5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-sunken text-muted-foreground">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </span>
        <div className="min-w-0">
          <div className="t-card truncate">{label}</div>
          <div className="t-caption text-muted-foreground">{sub}</div>
        </div>
      </div>
      <CountUp value={value} className="t-section shrink-0 tabular-nums" />
    </div>
  );
}
