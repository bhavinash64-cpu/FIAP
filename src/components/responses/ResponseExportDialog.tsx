import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileSpreadsheet, FileText, Loader2, Printer, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { downloadBlob, buildResponsesWorkbook, slugifyFilename } from "@/lib/exportExcel";
import {
  exportPdfDocument,
  exportWordDocument,
  type ReportMeta,
  type ReportTable,
} from "@/lib/exportDocuments";
import { buildFamilyResearchWorkbook, loadFamilyResearchData } from "@/lib/exportFamilies";
import { pushExportHistory } from "@/lib/exportHistory";
import { getResponsesForExport } from "@/lib/analytics";
import { listResponses } from "@/lib/responseExplorer";
import { getSurveyWithQuestions } from "@/lib/surveys";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration } from "@/lib/reports";
import { cn } from "@/lib/utils";

/**
 * Getting the data out — the one place it happens.
 *
 * The rule this dialog encodes: FORMAT is a question about the audience, and
 * CONTENT is a question about the unit of analysis. They are independent, so
 * they are two separate choices rather than six buttons named things like
 * "Export full Excel (families)".
 *
 *   Format   Excel → a statistician    Word → an editor    PDF → a reader
 *   Content  one row per family        vs   one row per submission
 *
 * The one place they interact is honest about itself: a 128-column matrix is
 * not a document, so choosing Word or PDF forces the summary content and says
 * why, rather than silently handing over a truncated file.
 */

type Format = "xlsx" | "doc" | "pdf";
type Content = "matrix" | "responses";

const FORMATS: { value: Format; icon: typeof FileSpreadsheet; label: string; blurb: string }[] = [
  {
    value: "xlsx",
    icon: FileSpreadsheet,
    label: "Excel (.xlsx)",
    blurb: "The research file. Opens in Excel, SPSS, R, Python and Power BI.",
  },
  {
    value: "doc",
    icon: FileText,
    label: "Word (.doc)",
    blurb: "A formatted report you can edit, annotate and paste into a chapter.",
  },
  {
    value: "pdf",
    icon: Printer,
    label: "PDF",
    blurb: "A fixed, print-ready report. Opens your print dialog — choose “Save as PDF”.",
  },
];

export function ResponseExportDialog({
  open,
  onOpenChange,
  surveyId,
  surveyTitle,
  rowCount,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The page's current survey filter, or "all". */
  surveyId: string;
  surveyTitle: string;
  rowCount: number;
}) {
  const [format, setFormat] = useState<Format>("xlsx");
  const [content, setContent] = useState<Content>("matrix");
  const [busy, setBusy] = useState<string | null>(null);

  /**
   * Whether the family-case schema is actually present. The migration that
   * creates it may not have been pushed in every environment, and finding that
   * out by watching a research export fail with a raw Postgres 42P01 is not an
   * acceptable way for an administrator to learn it. One cheap probe, and the
   * option explains itself instead.
   */
  const { data: familySchema, isPending: probing } = useQuery({
    queryKey: ["family-schema-available"],
    enabled: open,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { error } = await supabase.from("family_cases").select("id").limit(1);
      return { available: !error };
    },
  });

  const familyAvailable = familySchema?.available === true;
  const singleSurvey = surveyId !== "all";

  // A document cannot carry the matrix, and the matrix cannot span instruments
  // that do not share a question set. Both constraints are steering, not
  // blocking — they move the selection somewhere valid and say so on screen.
  const matrixAllowed = format === "xlsx" && familyAvailable;

  useEffect(() => {
    if (!matrixAllowed && content === "matrix") setContent("responses");
  }, [matrixAllowed, content]);

  useEffect(() => {
    if (open) setBusy(null);
  }, [open]);

  const responsesNeedsSurvey = content === "responses" && format === "xlsx" && !singleSurvey;

  const blockingReason = useMemo(() => {
    if (responsesNeedsSurvey) {
      return "Pick a single survey first. A response sheet is one instrument's question set across its rows — two different instruments cannot share a rectangular matrix.";
    }
    return null;
  }, [responsesNeedsSurvey]);

  async function run() {
    if (blockingReason) return;
    try {
      if (format === "xlsx" && content === "matrix") await exportMatrixWorkbook(setBusy);
      else if (format === "xlsx") await exportResponseWorkbook(surveyId, setBusy);
      else await exportReportDocument(format, surveyId, surveyTitle, setBusy);

      pushExportHistory({
        format,
        survey: singleSurvey ? surveyTitle : "All surveys",
        count: rowCount,
        at: new Date().toISOString(),
      });
      toast.success(format === "pdf" ? "Report ready to print" : "Export downloaded");
      onOpenChange(false);
    } catch (e) {
      toast.error(describeExportError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      // A half-finished export must not be dismissible: the click that closes
      // the dialog would orphan an in-flight query and leave no file and no
      // explanation.
      onOpenChange={(next) => !busy && onOpenChange(next)}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Export responses</DialogTitle>
          <DialogDescription>
            {rowCount} {rowCount === 1 ? "response" : "responses"} in the current view
            {singleSurvey ? ` · ${surveyTitle}` : " · all surveys"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <fieldset>
            <legend className="eyebrow mb-2">Format</legend>
            <div className="grid gap-2">
              {FORMATS.map((f) => (
                <Choice
                  key={f.value}
                  icon={f.icon}
                  label={f.label}
                  blurb={f.blurb}
                  recommended={f.value === "xlsx"}
                  selected={format === f.value}
                  disabled={!!busy}
                  onSelect={() => setFormat(f.value)}
                />
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="eyebrow mb-2">Content</legend>
            <div className="grid gap-2">
              {probing ? (
                <Skeleton className="h-[4.5rem] w-full rounded-surface" />
              ) : (
                <Choice
                  label="Family research matrix"
                  blurb={
                    familyAvailable
                      ? "One row per family, one column per question, plus a codebook, answer detail and case log."
                      : "Unavailable — the family case tables are not in this database yet. Apply the pending migration to enable it."
                  }
                  selected={content === "matrix"}
                  disabled={!!busy || !matrixAllowed}
                  hint={format !== "xlsx" ? "Excel only" : undefined}
                  onSelect={() => setContent("matrix")}
                />
              )}
              <Choice
                label="Response sheet"
                blurb="One row per submission, with the answers as columns. Works on any survey."
                selected={content === "responses"}
                disabled={!!busy}
                onSelect={() => setContent("responses")}
              />
            </div>
          </fieldset>

          {blockingReason && (
            <p className="flex items-start gap-2 rounded-field border border-border/70 bg-muted/50 p-3 t-caption text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-tertiary" strokeWidth={1.7} />
              <span>{blockingReason}</span>
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={!!busy}>
            Cancel
          </Button>
          <Button onClick={() => void run()} disabled={!!busy || !!blockingReason}>
            {busy ? (
              <>
                <Loader2 className="animate-spin" />
                {busy}
              </>
            ) : (
              <>Export</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** One large, tappable option. A <select> would hide the trade-off being made. */
function Choice({
  icon: Icon,
  label,
  blurb,
  selected,
  disabled,
  recommended,
  hint,
  onSelect,
}: {
  icon?: typeof FileSpreadsheet;
  label: string;
  blurb: string;
  selected: boolean;
  disabled?: boolean;
  recommended?: boolean;
  hint?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-surface border p-3.5 text-left transition-colors duration-fast",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        selected ? "border-primary bg-accent" : "border-border/70 bg-card hover:border-primary/40",
        disabled && "cursor-not-allowed opacity-55 hover:border-border/70",
      )}
    >
      {Icon && (
        <span
          className={cn(
            "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-control",
            selected ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("t-card", selected && "text-primary")}>{label}</span>
          {recommended && (
            <span className="rounded-pill bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
              Recommended
            </span>
          )}
          {hint && (
            <span className="rounded-pill bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        <span className="mt-1 block t-caption leading-relaxed text-muted-foreground">{blurb}</span>
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// The three export paths
// ---------------------------------------------------------------------------

type Progress = (label: string | null) => void;

async function exportMatrixWorkbook(setBusy: Progress) {
  setBusy("Loading families…");
  const data = await loadFamilyResearchData();
  setBusy("Building workbook…");
  const blob = await buildFamilyResearchWorkbook(data);
  downloadBlob(blob, `psydigihealth-family-research-${stamp()}.xlsx`);
}

async function exportResponseWorkbook(surveyId: string, setBusy: Progress) {
  setBusy("Loading survey…");
  const detail = await getSurveyWithQuestions(surveyId);
  if (!detail) throw new Error("That survey could not be loaded.");

  setBusy("Loading responses…");
  const rows = await getResponsesForExport(surveyId, detail.questions);

  setBusy("Building workbook…");
  const blob = await buildResponsesWorkbook(detail.survey, detail.questions, rows);
  downloadBlob(blob, `${slugifyFilename(detail.survey.title_en)}-responses-${stamp()}.xlsx`);
}

async function exportReportDocument(
  format: "doc" | "pdf",
  surveyId: string,
  surveyTitle: string,
  setBusy: Progress,
) {
  setBusy("Loading responses…");
  const all = await listResponses();
  const scoped = surveyId === "all" ? all : all.filter((r) => r.surveyId === surveyId);

  setBusy("Building report…");

  const withDuration = scoped.filter((r) => r.secondsTaken != null);
  const avgSeconds = withDuration.length
    ? Math.round(withDuration.reduce((a, r) => a + (r.secondsTaken ?? 0), 0) / withDuration.length)
    : null;
  const telugu = scoped.filter((r) => r.language === "te").length;

  const summary: ReportTable = {
    caption: "Summary",
    columns: [
      { key: "metric", label: "Metric" },
      { key: "value", label: "Value", align: "right" },
    ],
    rows: [
      { metric: "Responses", value: scoped.length },
      { metric: "Surveys covered", value: new Set(scoped.map((r) => r.surveyId)).size },
      { metric: "Answered in Telugu", value: telugu },
      { metric: "Answered in English", value: scoped.length - telugu },
      { metric: "Average time taken", value: avgSeconds == null ? "—" : formatDuration(avgSeconds) },
      {
        metric: "Earliest submission",
        value: scoped.length ? new Date(scoped[scoped.length - 1].submittedAt).toLocaleString() : "—",
      },
      { metric: "Latest submission", value: scoped.length ? new Date(scoped[0].submittedAt).toLocaleString() : "—" },
    ],
  };

  const detail: ReportTable = {
    caption: "Responses",
    columns: [
      { key: "reference", label: "Reference" },
      { key: "survey", label: "Survey" },
      { key: "language", label: "Language" },
      { key: "submitted", label: "Submitted" },
      { key: "duration", label: "Time taken", align: "right" },
    ],
    rows: scoped.map((r) => ({
      reference: r.referenceId,
      survey: r.surveyTitle,
      language: r.language === "te" ? "Telugu" : "English",
      submitted: new Date(r.submittedAt).toLocaleString(),
      duration: r.secondsTaken == null ? "—" : formatDuration(r.secondsTaken),
    })),
  };

  const meta: ReportMeta = {
    title: "Response report",
    subtitle: surveyId === "all" ? "All surveys" : surveyTitle,
    generatedAt: new Date(),
    rowCount: scoped.length,
    filters: [{ label: "Scope", value: surveyId === "all" ? "All surveys" : surveyTitle }],
  };

  if (format === "doc") {
    exportWordDocument(meta, [summary, detail], `psydigihealth-response-report-${stamp()}`);
    return;
  }
  setBusy("Opening print view…");
  await exportPdfDocument(meta, [summary, detail]);
}

function stamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * A missing relation means the migration has not been pushed, which is a
 * deployment fact an administrator can act on. Surfacing PostgREST's raw
 * "relation public.family_cases does not exist" instead would send them to a
 * developer for something they can fix themselves.
 */
function describeExportError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e ?? "");
  if (/does not exist|schema cache|42P01|PGRST205/i.test(message)) {
    return "The family case tables are not in this database yet. Apply the pending migration, then try again.";
  }
  return message || "The export could not be completed.";
}
