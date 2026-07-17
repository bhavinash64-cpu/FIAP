import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Download, FileText, Loader2, Share2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-72" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-surface" />
          ))}
        </div>
        <Skeleton className="h-[320px] rounded-surface" />
      </div>
    );
  }

  const hasResponses = (stats?.totalResponses ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8 sm:px-8 space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to={`/app/surveys/${survey.id}/edit`}><ArrowLeft className="mr-2" strokeWidth={1.5} />Back to editor</Link>
        </Button>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="eyebrow text-primary">Analytics</div>
            <h1 className="t-section mt-2">{survey.title_en}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RangeSwitcher value={range} onChange={setRange} />
            <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={exporting}>
              {exporting ? <Loader2 className="mr-2 animate-spin" strokeWidth={1.5} /> : <Download className="mr-2" strokeWidth={1.5} />}Excel
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/surveys/${survey.id}/report?range=${range}`} target="_blank"><FileText className="mr-2" strokeWidth={1.5} />PDF report</Link>
            </Button>
          </div>
        </div>
      </div>

      {!hasResponses ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Users}
            title="No responses yet"
            body="Share your survey link to start collecting responses."
            action={survey.slug ? <div className="w-full max-w-md"><ShareLinkCard slug={survey.slug} /></div> : (
              <Button asChild><Link to={`/app/surveys/${survey.id}/edit`}><Share2 className="mr-2" strokeWidth={1.5} />Publish this survey</Link></Button>
            )}
          />
        </Card>
      ) : (
        <>
          <OverviewCards stats={stats} />

          <Card>
            <CardHeader><CardTitle>Responses over time</CardTitle></CardHeader>
            <CardContent>
              {series === null ? <Skeleton className="h-[280px] rounded-field" /> : <TimeseriesChart data={series} />}
            </CardContent>
          </Card>

          <div>
            <h2 className="eyebrow mb-4">Per-question breakdown</h2>
            <div className="grid gap-6 lg:grid-cols-2">
              {questions.map((q) => <QuestionBreakdownCard key={q.id} question={q} since={since} />)}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
