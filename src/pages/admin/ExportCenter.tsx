import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, FileSpreadsheet, FileText, Loader2, Inbox, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listSurveys, getSurveyWithQuestions } from "@/lib/surveys";
import { getResponsesForExport, resolveReportRange, type RangeKey } from "@/lib/analytics";
import { buildResponsesWorkbook, downloadBlob, slugifyFilename } from "@/lib/exportExcel";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { useT } from "@/lib/i18n";

const RANGES: { key: RangeKey | "all"; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "12m", label: "Last 12 months" },
];

/**
 * One place to pull data out of the platform.
 *
 * Excel is generated in the browser from the same on-demand query the survey
 * analytics export uses; the PDF route is the print-optimised SurveyReport page
 * opened in a new tab, so "export PDF" is the browser's own Save-as-PDF over a
 * layout built for it. No server round trip either way.
 */
export default function ExportCenter() {
  const t = useT();
  const [surveyId, setSurveyId] = useState<string>("");
  const [range, setRange] = useState<RangeKey | "all">("all");
  const [exporting, setExporting] = useState(false);

  const { data: surveys, isLoading } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });

  const selected = useMemo(() => surveys?.find((s) => s.id === surveyId) ?? null, [surveys, surveyId]);

  // Default to the first survey with responses, else the first survey.
  const effectiveId = surveyId || surveys?.find((s) => s.response_count > 0)?.id || surveys?.[0]?.id || "";
  const effective = surveys?.find((s) => s.id === effectiveId) ?? selected;

  async function exportExcel() {
    if (!effective) return;
    setExporting(true);
    try {
      const detail = await getSurveyWithQuestions(effective.id);
      if (!detail) throw new Error("Survey not found.");
      const since = range === "all" ? undefined : resolveReportRange(range).since;
      const rows = await getResponsesForExport(effective.id, detail.questions, since);
      if (!rows.length) {
        toast.info("No responses in this range to export.");
        return;
      }
      const blob = await buildResponsesWorkbook(detail.survey, detail.questions, rows);
      downloadBlob(blob, `${slugifyFilename(effective.title_en)}-responses.xlsx`);
      toast.success(`Exported ${rows.length} responses`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export right now.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupInsights")}
        title={t("navExport")}
        subtitle="Download response data for official review — a formatted Excel workbook, or a print-ready PDF report."
      />

      {isLoading ? (
        <div className="mt-16 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : !surveys?.length ? (
        <div className="mt-8 rounded-surface border border-dashed border-border p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <Inbox className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">No surveys yet</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
            Once a survey has responses, its data can be exported here.
          </p>
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          <div className="rounded-surface border border-border/70 bg-card p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="eyebrow">Survey</span>
                <Select value={effectiveId} onValueChange={setSurveyId}>
                  <SelectTrigger className="mt-1.5 h-11 w-full">
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
              </label>

              <div className="block">
                <span className="eyebrow">Date range</span>
                <Tabs value={range} onValueChange={(v) => setRange(v as RangeKey | "all")} className="mt-1.5">
                  <TabsList className="h-11 w-full justify-start gap-1 overflow-x-auto rounded-control bg-sunken no-scrollbar">
                    {RANGES.map((r) => (
                      <TabsTrigger key={r.key} value={r.key} className="shrink-0 rounded-control text-xs">
                        {r.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </div>

            {effective && (
              <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-4 t-caption text-muted-foreground">
                <Table2 className="h-4 w-4" strokeWidth={1.6} />
                <span className="tabular-nums font-medium text-foreground">{effective.response_count}</span>
                responses all-time · {effective.question_count} questions
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <ExportOption
              icon={FileSpreadsheet}
              title="Excel workbook"
              body="One row per response, one column per question, with a frozen header and filters."
              action={
                <Button onClick={exportExcel} disabled={exporting || !effective} className="w-full gap-2">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download strokeWidth={1.8} />}
                  {exporting ? "Preparing…" : "Download .xlsx"}
                </Button>
              }
            />
            <ExportOption
              icon={FileText}
              title="PDF report"
              body="A formatted summary with per-question breakdowns, ready to print or save as PDF."
              action={
                <Button asChild variant="outline" className="w-full gap-2" disabled={!effective}>
                  {effective ? (
                    <Link to={`/app/surveys/${effective.id}/report?range=${range === "all" ? "" : range}`} target="_blank">
                      <FileText strokeWidth={1.8} />
                      Open PDF report
                    </Link>
                  ) : (
                    <span>
                      <FileText strokeWidth={1.8} />
                      Open PDF report
                    </span>
                  )}
                </Button>
              }
            />
          </div>
        </div>
      )}
    </PageContainer>
  );
}

function ExportOption({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: typeof FileText;
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-surface border border-border/70 bg-card p-5">
      <span className="grid h-11 w-11 place-items-center rounded-control bg-accent-tint">
        <Icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
      </span>
      <h3 className="mt-4 t-card">{title}</h3>
      <p className="mt-1.5 flex-1 t-caption leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-4">{action}</div>
    </div>
  );
}
