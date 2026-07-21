import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Shield, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintBarList } from "@/components/analytics/PrintBarList";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { getSurveyWithQuestions, type Survey, type SurveyQuestion } from "@/lib/surveys";
import { getQuestionBreakdown, getResponseCount, getSurveyStats, resolveReportRange, averageScore, type SurveyStats, type ValueCount } from "@/lib/analytics";

export default function SurveyReport() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { since, label } = resolveReportRange(params.get("range"));

  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [periodTotal, setPeriodTotal] = useState<number | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, ValueCount[]> | null>(null);
  const printed = useRef(false);

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoadError(false);
    (async () => {
      const data = await getSurveyWithQuestions(id);
      if (cancelled) return;
      if (!data) {
        setLoadError(true);
        return;
      }
      setSurvey(data.survey);
      setQuestions(data.questions);

      // A count query for the period total — never pull the whole dataset just
      // to display a number.
      const [s, count] = await Promise.all([getSurveyStats(id), getResponseCount(id, since)]);
      if (cancelled) return;
      setStats(s);
      setPeriodTotal(count);

      const entries = await Promise.all(
        data.questions
          .filter((q) => q.kind !== "short_text" && q.kind !== "long_text")
          .map(async (q) => [q.id, await getQuestionBreakdown(q, since)] as const),
      );
      if (cancelled) return;
      setBreakdowns(Object.fromEntries(entries));
    })().catch(() => {
      if (!cancelled) setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, params]);

  const ready = survey && questions && stats && periodTotal !== null && breakdowns !== null;

  useEffect(() => {
    if (ready && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [ready]);

  if (loadError) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <p className="t-section">Report unavailable</p>
          <p className="mt-2 t-body text-muted-foreground">This survey couldn't be loaded — it may have been deleted. Close this tab and try again from Reports.</p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} /></div>;
  }

  return (
    <div className="min-h-dvh bg-canvas print:bg-white">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          .no-print { display: none !important; }
          .report-section { break-inside: avoid; }
          body { background: hsl(var(--bg-surface)) !important; }
        }
      `}</style>

      <header className="report-section flex items-start justify-between border-b-2 border-primary pb-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 rounded-control bg-primary grid place-items-center shrink-0">
            <Shield className="h-6 w-6 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <div className="t-body font-semibold">Jeevana Insight</div>
            <div className="t-caption text-muted-foreground">Family Assessment Research Platform</div>
          </div>
        </div>
        <div className="text-right t-caption text-muted-foreground">
          <div>Generated {new Date().toLocaleString()}</div>
          <div className="mt-1 font-medium text-foreground">{label}</div>
        </div>
      </header>

      <div className="report-section mb-8">
        <div className="eyebrow">Survey report</div>
        <h1 className="t-title mt-2">{survey!.title_en}</h1>
        {survey!.description_en && <p className="t-body text-muted-foreground mt-2">{survey!.description_en}</p>}
      </div>

      <div className="report-section grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Responses in period", value: periodTotal },
          { label: "All-time responses", value: stats!.totalResponses },
          { label: "Completion rate", value: stats!.completionRate == null ? "—" : `${Math.round(stats!.completionRate * 100)}%` },
          { label: "Avg. time to complete", value: stats!.avgSecondsToComplete ? `${Math.round(stats!.avgSecondsToComplete / 60)}m` : "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-control border border-border p-4">
            <div className="eyebrow">{s.label}</div>
            <div className="mt-1 t-section tabular-nums">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="report-section mb-4">
        <h2 className="t-section">Responses by question</h2>
      </div>

      <div className="divide-y divide-border">
        {questions!.map((q, i) => {
          const isText = q.kind === "short_text" || q.kind === "long_text";
          const counts = breakdowns![q.id];
          const total = counts?.reduce((a, c) => a + c.count, 0) ?? 0;
          const avg = counts ? averageScore(counts) : null;
          const isScale = q.kind === "likert5" || q.kind === "rating5";

          return (
            <div key={q.id} className="report-section flex items-start gap-3 py-6 first:pt-0">
              <QuestionTypeIcon kind={q.kind} className="h-4 w-4 text-muted-foreground mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="t-card">{i + 1}. {q.prompt_en}</div>
                {isText ? (
                  <p className="mt-2 t-caption text-muted-foreground">Open-ended responses — see the full Excel export for all answers.</p>
                ) : total === 0 ? (
                  <p className="mt-2 t-caption text-muted-foreground">No answers in this period.</p>
                ) : (
                  <div className="mt-3">
                    {isScale && <div className="t-caption font-semibold text-foreground mb-2">Average: {avg?.toFixed(1)} / 5 · {total} answers</div>}
                    <PrintBarList counts={counts} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="report-section mt-8 pt-4 border-t border-border t-caption text-muted-foreground text-center">
        Research report · Jeevana Insight · For authorised use only
      </footer>
    </div>
  );
}
