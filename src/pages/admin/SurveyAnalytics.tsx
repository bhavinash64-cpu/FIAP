import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Loader2, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/survey/EmptyState";
import { ShareLinkCard } from "@/components/survey/ShareLinkCard";
import { RangeSwitcher } from "@/components/analytics/RangeSwitcher";
import { OverviewCards } from "@/components/analytics/OverviewCards";
import { TimeseriesChart } from "@/components/analytics/TimeseriesChart";
import { QuestionBreakdownCard } from "@/components/analytics/QuestionBreakdownCard";
import { getSurveyWithQuestions, type Survey, type SurveyQuestion } from "@/lib/surveys";
import { getResponsesForExport, getResponseTimeseries, getSurveyStats, rangeToSince, type RangeKey, type SurveyStats, type TimeseriesPoint } from "@/lib/analytics";
import { buildResponsesWorkbook, downloadBlob, slugifyFilename } from "@/lib/exportExcel";

export default function SurveyAnalytics() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);
  const [range, setRange] = useState<RangeKey>("30d");
  const [stats, setStats] = useState<SurveyStats | null>(null);
  const [series, setSeries] = useState<TimeseriesPoint[] | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSurveyWithQuestions(id).then((data) => {
      if (!data) return;
      setSurvey(data.survey);
      setQuestions(data.questions);
    });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    getSurveyStats(id).then(setStats);
  }, [id, range]);

  useEffect(() => {
    if (!id) return;
    setSeries(null);
    getResponseTimeseries(id, range).then(setSeries);
  }, [id, range]);

  const since = useMemo(() => rangeToSince(range).since, [range]);

  async function handleExportExcel() {
    if (!survey || !questions) return;
    setExporting(true);
    try {
      const rows = await getResponsesForExport(survey.id, questions, since);
      if (!rows.length) { toast.info("No responses in this time range to export."); return; }
      const blob = await buildResponsesWorkbook(survey, questions, rows);
      downloadBlob(blob, `${slugifyFilename(survey.title_en)}-responses.xlsx`);
      toast.success("Excel file downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the export.");
    } finally {
      setExporting(false);
    }
  }

  if (!survey || !questions) {
    return <div className="min-h-[50vh] grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const hasResponses = (stats?.totalResponses ?? 0) > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to={`/app/surveys/${survey.id}/edit`}><ArrowLeft className="h-4 w-4 mr-1.5" />Back to editor</Link></Button>
        <div className="mt-2 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-primary">Analytics</div>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight">{survey.title_en}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RangeSwitcher value={range} onChange={setRange} />
            <Button variant="outline" size="sm" className="rounded-lg" onClick={handleExportExcel} disabled={exporting}>
              {exporting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}Excel
            </Button>
            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link to={`/app/surveys/${survey.id}/report?range=${range}`} target="_blank"><FileText className="h-3.5 w-3.5 mr-1.5" />PDF report</Link>
            </Button>
          </div>
        </div>
      </div>

      {!hasResponses ? (
        <Card className="rounded-2xl border-dashed border-border/70">
          <EmptyState
            icon={Users}
            title="No responses yet"
            body="Share your survey link to start collecting responses."
            action={survey.slug ? <div className="w-full max-w-md"><ShareLinkCard slug={survey.slug} /></div> : (
              <Button asChild className="rounded-xl"><Link to={`/app/surveys/${survey.id}/edit`}><Share2 className="h-4 w-4 mr-1.5" />Publish this survey</Link></Button>
            )}
          />
        </Card>
      ) : (
        <>
          <OverviewCards stats={stats} />

          <Card className="rounded-2xl border-border/70">
            <CardHeader className="pb-2"><CardTitle className="text-base">Responses over time</CardTitle></CardHeader>
            <CardContent>
              {series === null ? <div className="h-[280px] grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div> : <TimeseriesChart data={series} />}
            </CardContent>
          </Card>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Per-question breakdown</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {questions.map((q) => <QuestionBreakdownCard key={q.id} question={q} since={since} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
