import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Inbox,
  CalendarRange,
  Users,
  Check,
  History,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listSurveys, getSurveyWithQuestions } from "@/lib/surveys";
import { getResponsesForExport, resolveReportRange, type RangeKey } from "@/lib/analytics";
import { buildResponsesWorkbook, downloadBlob, slugifyFilename } from "@/lib/exportExcel";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const RANGES: { key: RangeKey | "all"; label: string }[] = [
  { key: "all", label: "All time" },
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "12m", label: "12 months" },
];

interface ExportRecord {
  format: "xlsx" | "pdf";
  survey: string;
  count: number | null;
  at: string;
}
const HISTORY_KEY = "exportHistory";

function loadHistory(): ExportRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]") as ExportRecord[];
  } catch {
    return [];
  }
}
function pushHistory(rec: ExportRecord): ExportRecord[] {
  const next = [rec, ...loadHistory()].slice(0, 8);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  return next;
}
function relTime(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Exporting as a complete workflow: pick the survey and range, see exactly what
 * will be included (which builds confidence before the download), choose a
 * document format that names what's inside and who it's for, and keep a short
 * history of what was pulled.
 */
export default function ExportCenter() {
  const t = useT();
  const [surveyId, setSurveyId] = useState<string>("");
  const [range, setRange] = useState<RangeKey | "all">("all");
  const [exporting, setExporting] = useState(false);
  const [history, setHistory] = useState<ExportRecord[]>(loadHistory);

  const { data: surveys, isPending } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });

  const effectiveId = surveyId || surveys?.find((s) => s.response_count > 0)?.id || surveys?.[0]?.id || "";
  const effective = surveys?.find((s) => s.id === effectiveId) ?? null;
  const since = range === "all" ? undefined : resolveReportRange(range).since;

  // Exact count for the chosen survey + range — the confidence signal before
  // anyone downloads. A lightweight head/count query, not the full pull.
  const { data: rangeCount, isFetching: counting } = useQuery({
    queryKey: ["export-count", effectiveId, range],
    enabled: !!effectiveId,
    queryFn: async () => {
      let q = supabase.from("survey_responses").select("id", { count: "exact", head: true }).eq("survey_id", effectiveId);
      if (since) q = q.gte("submitted_at", since.toISOString());
      const { count } = await q;
      return count ?? 0;
    },
  });

  async function exportExcel() {
    if (!effective) return;
    setExporting(true);
    try {
      const detail = await getSurveyWithQuestions(effective.id);
      if (!detail) throw new Error("Survey not found.");
      const rows = await getResponsesForExport(effective.id, detail.questions, since);
      if (!rows.length) {
        toast.info("No responses in this range to export.");
        return;
      }
      const blob = await buildResponsesWorkbook(detail.survey, detail.questions, rows);
      downloadBlob(blob, `${slugifyFilename(effective.title_en)}-responses.xlsx`);
      setHistory(pushHistory({ format: "xlsx", survey: effective.title_en, count: rows.length, at: new Date().toISOString() }));
      toast.success(`Exported ${rows.length} responses`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export right now.");
    } finally {
      setExporting(false);
    }
  }

  function logPdf() {
    if (!effective) return;
    setHistory(pushHistory({ format: "pdf", survey: effective.title_en, count: rangeCount ?? null, at: new Date().toISOString() }));
  }

  const rangeLabel = RANGES.find((r) => r.key === range)?.label ?? "All time";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupInsights")}
        title={t("navExport")}
        subtitle="Turn response data into a document ready for analysis, review, or the record."
      />

      {isPending ? (
        <div className="mt-16 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : !surveys?.length ? (
        <div className="mt-8 rounded-surface border border-dashed border-border p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <Inbox className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">Nothing to export yet</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
            Publish a survey and collect a few responses — then export them here as a workbook or a report.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-12">
          {/* Configure + confidence */}
          <div className="lg:col-span-8">
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
                    <TabsList className="h-11 w-full justify-start gap-1 rounded-control bg-sunken">
                      {RANGES.map((r) => (
                        <TabsTrigger key={r.key} value={r.key} className="flex-1 rounded-control text-xs">
                          {r.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              </div>

              {/* Confidence strip — exactly what will be included */}
              {effective && (
                <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border/60 pt-5">
                  <Meta icon={Users} label="Responses" value={counting ? "…" : String(rangeCount ?? 0)} hint={rangeLabel} />
                  <Meta icon={FileText} label="Questions" value={String(effective.question_count)} hint="columns" />
                  <Meta icon={CalendarRange} label="Range" value={rangeLabel} hint="filter" />
                </dl>
              )}
            </div>

            {/* Format cards */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <FormatCard
                icon={FileSpreadsheet}
                format=".xlsx"
                title="Excel workbook"
                inside={["One row per response", "One column per question", "Frozen header + column filters"]}
                bestFor="Analysts and statisticians — open in Excel, or import into SPSS or R."
                preview={<SheetPreview />}
                action={
                  <Button onClick={exportExcel} disabled={exporting || !effective || rangeCount === 0} className="w-full gap-2">
                    {exporting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                      </>
                    ) : (
                      <>
                        <Download strokeWidth={1.8} /> Download workbook
                      </>
                    )}
                  </Button>
                }
              />
              <FormatCard
                icon={FileText}
                format="PDF"
                title="Report"
                inside={["Executive summary + key metrics", "Per-question breakdowns", "Print-ready formatting"]}
                bestFor="Leadership and official review — print it, or save as PDF."
                preview={<DocPreview />}
                action={
                  <Button asChild variant="outline" className="w-full gap-2" disabled={!effective}>
                    {effective ? (
                      <Link
                        to={`/app/surveys/${effective.id}/report?range=${range === "all" ? "" : range}`}
                        target="_blank"
                        onClick={logPdf}
                      >
                        <ExternalLink strokeWidth={1.8} /> Open report
                      </Link>
                    ) : (
                      <span>Open report</span>
                    )}
                  </Button>
                }
              />
            </div>
          </div>

          {/* Export history */}
          <aside className="lg:col-span-4">
            <div className="rounded-surface border border-border/70 bg-card p-5">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
                <h2 className="t-card">Recent exports</h2>
              </div>
              {history.length === 0 ? (
                <p className="t-caption leading-relaxed text-muted-foreground">
                  Your recent exports will be listed here, so you can see what was pulled and when.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {history.map((h, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-control",
                          h.format === "xlsx" ? "bg-[hsl(var(--success)/0.12)] text-success" : "bg-accent-tint text-primary",
                        )}
                      >
                        {h.format === "xlsx" ? <FileSpreadsheet className="h-4 w-4" strokeWidth={1.7} /> : <FileText className="h-4 w-4" strokeWidth={1.7} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate t-caption font-medium">{h.survey}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {h.format === "xlsx" ? "Workbook" : "Report"}
                          {h.count != null ? ` · ${h.count} responses` : ""} · {relTime(h.at)}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}

function Meta({ icon: Icon, label, value, hint }: { icon: typeof Users; label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 eyebrow text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />
        {label}
      </div>
      <div className="mt-1 t-section tabular-nums leading-none">{value}</div>
      <div className="mt-1 t-caption text-tertiary">{hint}</div>
    </div>
  );
}

function FormatCard({
  icon: Icon,
  format,
  title,
  inside,
  bestFor,
  preview,
  action,
}: {
  icon: LucideIconType;
  format: string;
  title: string;
  inside: string[];
  bestFor: string;
  preview: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-surface border border-border/70 bg-card">
      {/* Document preview */}
      <div className="grid h-32 place-items-center border-b border-border/60 bg-gradient-to-b from-sunken/60 to-transparent">
        {preview}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-accent-tint text-primary">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </span>
          <div>
            <div className="t-card">{title}</div>
            <div className="eyebrow text-tertiary">{format}</div>
          </div>
        </div>

        <ul className="mt-4 space-y-1.5">
          {inside.map((line) => (
            <li key={line} className="flex items-start gap-2 t-caption text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.2} />
              {line}
            </li>
          ))}
        </ul>

        <p className="mt-4 rounded-[12px] bg-muted/50 px-3 py-2 t-caption leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Best for · </span>
          {bestFor}
        </p>

        <div className="mt-auto pt-4">{action}</div>
      </div>
    </div>
  );
}

type LucideIconType = typeof FileText;

/** A tiny abstract spreadsheet — rows and columns. */
function SheetPreview() {
  return (
    <div className="grid w-40 grid-cols-4 gap-1 rounded-[8px] border border-border/70 bg-card p-2 shadow-sm">
      {Array.from({ length: 4 }).map((_, c) => (
        <div key={c} className="h-2.5 rounded-[3px] bg-primary/50" />
      ))}
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="h-2 rounded-[3px] bg-muted-foreground/15" />
      ))}
    </div>
  );
}

/** A tiny abstract document — a heading and text lines. */
function DocPreview() {
  return (
    <div className="w-28 space-y-1.5 rounded-[8px] border border-border/70 bg-card p-3 shadow-sm">
      <div className="h-2.5 w-3/4 rounded-[3px] bg-primary/60" />
      <div className="h-1.5 w-full rounded-[3px] bg-muted-foreground/15" />
      <div className="h-1.5 w-full rounded-[3px] bg-muted-foreground/15" />
      <div className="h-1.5 w-2/3 rounded-[3px] bg-muted-foreground/15" />
      <div className="mt-2 flex items-end gap-1">
        {[8, 12, 6, 14].map((h, i) => (
          <div key={i} className="w-2 rounded-[2px] bg-accent" style={{ height: h }} />
        ))}
      </div>
    </div>
  );
}
