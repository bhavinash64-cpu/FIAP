import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Shield, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintBarList } from "@/components/analytics/PrintBarList";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { getSurveyWithQuestions, type Survey, type SurveyQuestion } from "@/lib/surveys";
import { getQuestionBreakdown, getResponsesForExport, getSurveyStats, resolveReportRange, averageScore, type SurveyStats, type ValueCount } from "@/lib/analytics";

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

  useEffect(() => {
    if (!id) return;
    (async () => {
      const data = await getSurveyWithQuestions(id);
      if (!data) return;
      setSurvey(data.survey);
      setQuestions(data.questions);

      const [s, exportRows] = await Promise.all([getSurveyStats(id), getResponsesForExport(id, data.questions, since)]);
      setStats(s);
      setPeriodTotal(exportRows.length);

      const entries = await Promise.all(
        data.questions
          .filter((q) => q.kind !== "short_text" && q.kind !== "long_text")
          .map(async (q) => [q.id, await getQuestionBreakdown(q, since)] as const),
      );
      setBreakdowns(Object.fromEntries(entries));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, params]);

  const ready = survey && questions && stats && periodTotal !== null && breakdowns !== null;

  useEffect(() => {
    if (ready && !printed.current) {
      printed.current = true;
      setTimeout(() => window.print(), 400);
    }
  }, [ready]);

  if (!ready) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="min-h-dvh bg-[#f4f5f7] print:bg-white">
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 12mm; }
          .no-print { display: none !important; }
          .report-section { break-inside: avoid; }
          body { background: #fff !important; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 border-b border-border/60 bg-white/95 backdrop-blur px-4 py-3 flex items-center justify-between">
        <div className="text-sm font-medium text-muted-foreground">Report preview — use your browser's print dialog to save as PDF</div>
        <Button size="sm" onClick={() => window.print()} className="rounded-lg"><Printer className="h-3.5 w-3.5 mr-1.5" />Print / Save as PDF</Button>
      </div>

      <div className="mx-auto max-w-3xl bg-white print:shadow-none shadow-sm my-6 print:my-0 p-8 sm:p-10 print:p-0 text-[#171a21]">
        <header className="report-section flex items-start justify-between border-b-2 border-[#122A54] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#122A54] grid place-items-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">AP Police Family Assessment Platform</div>
              <div className="text-xs text-muted-foreground">Government of Andhra Pradesh · Department of Police</div>
            </div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>Generated {new Date().toLocaleString()}</div>
            <div className="mt-0.5 font-medium text-foreground">{label}</div>
          </div>
        </header>

        <div className="report-section mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-[#122A54]">Survey report</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{survey!.title_en}</h1>
          {survey!.description_en && <p className="mt-1.5 text-sm text-muted-foreground">{survey!.description_en}</p>}
        </div>

        <div className="report-section grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Responses in period", value: periodTotal },
            { label: "All-time responses", value: stats!.totalResponses },
            { label: "Completion rate", value: stats!.completionRate == null ? "—" : `${Math.round(stats!.completionRate * 100)}%` },
            { label: "Avg. time to complete", value: stats!.avgSecondsToComplete ? `${Math.round(stats!.avgSecondsToComplete / 60)}m` : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border border-border/60 p-3">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{s.label}</div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="space-y-5">
          {questions!.map((q, i) => {
            const isText = q.kind === "short_text" || q.kind === "long_text";
            const counts = breakdowns![q.id];
            const total = counts?.reduce((a, c) => a + c.count, 0) ?? 0;
            const avg = counts ? averageScore(counts) : null;
            const isScale = q.kind === "likert5" || q.kind === "rating5";

            return (
              <div key={q.id} className="report-section rounded-lg border border-border/60 p-4">
                <div className="flex items-start gap-2">
                  <QuestionTypeIcon kind={q.kind} className="h-4 w-4 text-[#122A54] mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{i + 1}. {q.prompt_en}</div>
                    {isText ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">Open-ended responses — see the full Excel export for all answers.</p>
                    ) : total === 0 ? (
                      <p className="mt-1.5 text-xs text-muted-foreground">No answers in this period.</p>
                    ) : (
                      <div className="mt-2.5">
                        {isScale && <div className="text-sm font-semibold mb-1.5">Average: {avg?.toFixed(1)} / 5 · {total} answers</div>}
                        <PrintBarList counts={counts} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <footer className="report-section mt-8 pt-4 border-t border-border/60 text-[10px] text-muted-foreground text-center">
          Official report · AP Police Family Assessment Platform · For authorised use only
        </footer>
      </div>
    </div>
  );
}
