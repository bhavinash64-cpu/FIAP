import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Inbox, BarChart3, FileText, Users, ClipboardList } from "lucide-react";
import { listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { CountUp } from "@/components/CountUp";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { staggerParent, staggerChild, easeOut } from "@/lib/motion";

export default function Responses() {
  const [surveys, setSurveys] = useState<SurveyWithCounts[] | null>(null);

  useEffect(() => {
    listSurveys().then(setSurveys).catch(() => setSurveys([]));
  }, []);

  const stats = useMemo(() => {
    const list = surveys ?? [];
    return { total: list.reduce((n, s) => n + s.response_count, 0), surveys: list.length, live: list.filter((s) => s.status === "published").length };
  }, [surveys]);

  const rows = surveys ?? [];

  return (
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header>
        <div className="eyebrow text-primary">Data</div>
        <h1 className="t-title mt-2">Responses</h1>
        <p className="t-body mt-3 max-w-xl text-muted-foreground">Every survey and how many responses it has collected. Open one to analyse, review text answers or export.</p>
      </header>

      <motion.div variants={staggerParent} initial="hidden" animate="show" className="mt-8 grid grid-cols-3 gap-4">
        <Stat icon={Inbox} label="Total responses" value={stats.total} />
        <Stat icon={ClipboardList} label="Surveys" value={stats.surveys} />
        <Stat icon={BarChart3} label="Live" value={stats.live} />
      </motion.div>

      <Card className="mt-6 overflow-hidden">
        {surveys === null ? (
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-none" />)}
          </div>
        ) : rows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: easeOut }}
            className="flex flex-col items-center gap-4 px-6 py-24 text-center"
          >
            <div className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
              <Inbox className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <h2 className="t-section">No surveys yet</h2>
            <p className="t-body max-w-sm text-muted-foreground">Create and publish one, then responses will appear here.</p>
            <Button asChild>
              <Link to="/app/surveys">Go to surveys →</Link>
            </Button>
          </motion.div>
        ) : (
          <motion.div variants={staggerParent} initial="hidden" animate="show" className="divide-y divide-border">
            {rows.map((s) => (
              <motion.div
                key={s.id}
                variants={staggerChild}
                className="flex flex-wrap items-center gap-4 px-6 py-6 transition-colors duration-base ease-out hover:bg-sunken sm:flex-nowrap"
              >
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-accent-tint">
                  <ClipboardList className="h-[18px] w-[18px] text-primary" strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/app/surveys/${s.id}/edit`} className="t-card block truncate hover:text-primary">{s.title_en}</Link>
                  <div className="t-caption mt-1 text-muted-foreground">{s.question_count} questions · {s.response_count} responses</div>
                </div>
                <StatusBadge status={s.status} />
                <div className="flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/surveys/${s.id}/analytics`}><BarChart3 className="h-3.5 w-3.5" strokeWidth={1.5} /> Analytics</Link>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/app/surveys/${s.id}/report`}><FileText className="h-3.5 w-3.5" strokeWidth={1.5} /> Report</Link>
                  </Button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </Card>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number }) {
  return (
    <motion.div variants={staggerChild}>
      <Card className="flex items-center gap-4 p-6 transition-[transform,box-shadow] duration-base ease-out hover:-translate-y-[2px] hover:shadow-md">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-accent-tint text-primary">
          <Icon className="h-5 w-5" strokeWidth={1.5} />
        </span>
        <div>
          <div className="t-title leading-none tabular-nums"><CountUp value={value} /></div>
          <div className="t-caption mt-1 text-muted-foreground">{label}</div>
        </div>
      </Card>
    </motion.div>
  );
}
