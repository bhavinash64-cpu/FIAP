import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileBarChart2, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/survey/EmptyState";
import { PeriodComparisonCard } from "@/components/analytics/PeriodComparisonCard";
import { listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { getPeriodComparison, type Period, type PeriodComparison } from "@/lib/analytics";

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

  return (
    <div className="mx-auto max-w-4xl px-4 sm:px-6 py-8 space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">Reports</div>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Weekly, monthly & yearly reports</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">Period-over-period response trends, ready to export for official review.</p>
      </div>

      {surveys === null ? (
        <div className="py-16 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : surveys.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-border/70">
          <EmptyState icon={FileBarChart2} title="No surveys yet" body="Create a survey first — reports will appear here once it has responses." />
        </Card>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Select value={surveyId} onValueChange={setSurveyId}>
              <SelectTrigger className="h-10 rounded-xl sm:w-72"><SelectValue placeholder="Choose a survey" /></SelectTrigger>
              <SelectContent>
                {surveys.map((s) => <SelectItem key={s.id} value={s.id}>{s.title_en}</SelectItem>)}
              </SelectContent>
            </Select>

            <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <TabsList className="rounded-xl">
                <TabsTrigger value="week" className="rounded-lg">Weekly</TabsTrigger>
                <TabsTrigger value="month" className="rounded-lg">Monthly</TabsTrigger>
                <TabsTrigger value="year" className="rounded-lg">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>

            {selected && (
              <Button asChild variant="outline" size="sm" className="rounded-lg sm:ml-auto">
                <Link to={`/app/surveys/${selected.id}/report?range=${period}`} target="_blank">
                  <FileText className="h-3.5 w-3.5 mr-1.5" />Export PDF
                </Link>
              </Button>
            )}
          </div>

          {comparison === null ? (
            <div className="py-16 grid place-items-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <PeriodComparisonCard period={period} data={comparison} />
          )}
        </>
      )}
    </div>
  );
}
