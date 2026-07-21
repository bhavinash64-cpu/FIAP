import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, FileText, Loader2, Share2, Users, SearchX } from "lucide-react";
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
import { getSurveyWithQuestions } from "@/lib/surveys";
import { getResponsesForExport, getResponseTimeseries, getSurveyStats, rangeToSince, type RangeKey } from "@/lib/analytics";
import { buildResponsesWorkbook, downloadBlob, slugifyFilename } from "@/lib/exportExcel";

export default function SurveyAnalytics() {
  const { id } = useParams();
  const [range, setRange] = useState<RangeKey>("30d");
  const [exporting, setExporting] = useState(false);

  // React Query owns loading/error/race: a rejected fetch surfaces via isError
  // (no permanent skeleton, no unhandled rejection), and because the timeseries
  // is keyed by range, a fast range switch can never let an out-of-order
  // response overwrite newer data. Stats are NOT keyed by range (getSurveyStats
  // ignores it), so switching range no longer refetches them.
  const detail = useQuery({ queryKey: ["survey-detail", id], queryFn: () => getSurveyWithQuestions(id!), enabled: !!id });
  const { data: stats } = useQuery({ queryKey: ["survey-stats", id], queryFn: () => getSurveyStats(id!), enabled: !!id });
  const { data: series } = useQuery({ queryKey: ["survey-timeseries", id, range], queryFn: () => getResponseTimeseries(id!, range), enabled: !!id });

  const survey = detail.data?.survey ?? null;
  const questions = detail.data?.questions ?? null;
  const since = useMemo(() => rangeToSince(range).since, [range]);

  async function handleExportExcel() {
    if (!survey || !questions) return;
    setExporting(true);
    try {
      const rows = await getResponsesForExport(survey.id, questions, since);
      if (!rows.length) {
        toast.info("No responses in this time range to export.");
        return;
      }
      const blob = await buildResponsesWorkbook(survey, questions, rows);
      downloadBlob(blob, `${slugifyFilename(survey.title_en)}-responses.xlsx`);
      toast.success(`Exported ${rows.length} responses`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build the export.");
    } finally {
      setExporting(false);
    }
  }

  // Missing / deleted survey, or a failed load — an explicit state, never an
  // endless skeleton.
  if (detail.isError || (detail.isSuccess && !detail.data)) {
    return (
      <div className="grid min-h-[60vh] w-full place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <SearchX className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 t-section">Survey not found</h1>
          <p className="mx-auto mt-2 max-w-xs t-body text-muted-foreground">
            This survey couldn't be loaded — it may have been deleted.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/app/surveys">
              <ArrowLeft strokeWidth={1.5} />
              Back to surveys
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!survey || !questions) {
    return (
      <div className="w-full space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
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
    <div className="w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8">
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
            title="Analytics come to life with your first responses"
            body="Once families begin answering, this page tells the story: your key metrics at the top, the response trend over time, and a breakdown of every question — completion, distributions, and the exact answers given."
            action={survey.slug ? <div className="w-full max-w-md"><ShareLinkCard slug={survey.slug} /></div> : (
              <Button asChild><Link to={`/app/surveys/${survey.id}/edit`}><Share2 className="mr-2" strokeWidth={1.5} />Publish this survey</Link></Button>
            )}
          />
        </Card>
      ) : (
        <div className="space-y-10">
          {/* The story, top to bottom: the numbers, then the trend, then each question. */}
          <section>
            <h2 className="mb-4 eyebrow text-primary">Key metrics</h2>
            <OverviewCards stats={stats} />
          </section>

          <section>
            <h2 className="mb-4 eyebrow text-primary">Response trend</h2>
            <Card>
              <CardHeader><CardTitle>Responses over time</CardTitle></CardHeader>
              <CardContent>
                {series ? <TimeseriesChart data={series} /> : <Skeleton className="h-[280px] rounded-field" />}
              </CardContent>
            </Card>
          </section>

          <section>
            <h2 className="mb-1 eyebrow text-primary">Question-level analysis</h2>
            <p className="mb-4 t-caption text-muted-foreground">Completion and the distribution of answers for every question.</p>
            <div className="grid gap-6 lg:grid-cols-2">
              {questions.map((q) => <QuestionBreakdownCard key={q.id} question={q} since={since} />)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
