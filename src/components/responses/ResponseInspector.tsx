import { useQuery } from "@tanstack/react-query";
import { Download, FileText, MinusCircle, Printer } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Inspector, InspectorSection } from "@/components/admin/Inspector";
import { PrintSheet } from "@/components/share/PrintSheet";
import { getResponseDetail, type ResponseListItem } from "@/lib/responseExplorer";
import { buildSingleResponseWorkbook, downloadBlob, slugifyFilename } from "@/lib/exportExcel";
import { formatDuration } from "@/lib/reports";
import { printSheetOnly } from "@/lib/share";
import type { LangMode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * One family's submission, read end to end without leaving the workspace.
 *
 * The answer is shown with the glyph the parent actually tapped where the scale
 * carries one — an administrator reading a case over the phone is looking at
 * the same face the family saw, not a re-coded integer.
 */

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

const languageLabel = (code: string) => (code === "te" ? "Telugu" : "English");

export function ResponseInspector({
  item,
  mode,
  onClose,
  onPrev,
  onNext,
  positionLabel,
}: {
  item: ResponseListItem | null;
  mode: LangMode;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  positionLabel?: string;
}) {
  const { data: detail, isPending, isError } = useQuery({
    queryKey: ["response-detail", item?.id, mode],
    queryFn: () => getResponseDetail(item!.id, item!.surveyId, mode),
    enabled: !!item,
  });

  async function exportOne() {
    if (!item || !detail) return;
    try {
      const blob = await buildSingleResponseWorkbook({
        referenceId: item.referenceId,
        surveyTitle: item.surveyTitle,
        submittedAt: item.submittedAt,
        language: item.language,
        completionPct: detail.completionPct,
        duration: formatDuration(item.secondsTaken),
        answers: detail.answers.map((a) => ({ prompt: a.prompt, answer: a.answer })),
      });
      downloadBlob(blob, `${slugifyFilename(item.surveyTitle)}-${item.referenceId}.xlsx`);
      toast.success("Response exported");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export this response.");
    }
  }

  return (
    <>
      <Inspector
        open={!!item}
        onOpenChange={(open) => !open && onClose()}
        eyebrow="Response"
        title={<span className="font-mono tracking-wide">{item?.referenceId ?? ""}</span>}
        subtitle={item?.surveyTitle}
        onPrev={onPrev}
        onNext={onNext}
        positionLabel={positionLabel}
        headerMeta={
          item && (
            <>
              <Meta label="Submitted" value={formatDate(item.submittedAt)} />
              <Meta label="Language" value={languageLabel(item.language)} />
              <Meta label="Completion" value={detail ? `${detail.completionPct}%` : "—"} />
              <Meta label="Time taken" value={formatDuration(item.secondsTaken)} />
            </>
          )
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportOne} disabled={!detail}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.7} /> Export response
            </Button>
            <Button size="sm" variant="outline" onClick={printSheetOnly} disabled={!detail}>
              <Printer className="h-3.5 w-3.5" strokeWidth={1.7} /> Print response
            </Button>
            {detail && (
              <span className="ml-auto t-caption tabular-nums text-tertiary">
                {detail.answered} of {detail.total} answered
              </span>
            )}
          </div>
        }
      >
        {isPending ? (
          <div className="space-y-5 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-1/3" />
              </div>
            ))}
          </div>
        ) : isError || !detail ? (
          <p className="py-10 text-center t-body text-muted-foreground">
            Couldn't load this response. Close the panel and try again.
          </p>
        ) : (
          <div className="space-y-6">
            <InspectorSection title="Answers">
              <ol className="divide-y divide-border">
                {detail.answers.map((a, i) => (
                  <li key={a.questionId} className="flex gap-3 py-3">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-muted text-[11px] font-bold tabular-nums text-muted-foreground">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="t-body font-medium leading-snug">{a.prompt}</div>
                      <div className="mt-1 flex items-center gap-2">
                        {a.visual?.emoji && (
                          <span aria-hidden="true" className="text-lg leading-none">
                            {a.visual.emoji}
                          </span>
                        )}
                        {!a.visual?.emoji && a.visual?.level && a.visual.total && (
                          <span className="flex items-center gap-0.5" aria-hidden="true">
                            {Array.from({ length: a.visual.total }).map((_, step) => (
                              <span
                                key={step}
                                className={cn(
                                  "h-1.5 w-3 rounded-pill",
                                  step < (a.visual?.level ?? 0) ? "bg-primary" : "bg-sunken",
                                )}
                              />
                            ))}
                          </span>
                        )}
                        <span
                          className={cn(
                            "t-body",
                            a.answer
                              ? "font-semibold text-primary"
                              : "inline-flex items-center gap-1.5 text-muted-foreground",
                          )}
                        >
                          {a.answer ?? (
                            <>
                              <MinusCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                              Not answered
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </InspectorSection>

            {detail.notes.length > 0 && (
              <InspectorSection title="Notes">
                <div className="space-y-2.5">
                  {detail.notes.map((n, i) => (
                    <figure key={i} className="rounded-field border border-border/70 bg-sunken/60 p-3">
                      <figcaption className="t-caption text-muted-foreground">{n.prompt}</figcaption>
                      <blockquote className="mt-1 t-body leading-relaxed">{n.text}</blockquote>
                    </figure>
                  ))}
                </div>
              </InspectorSection>
            )}
          </div>
        )}
      </Inspector>

      {/* Paper version of exactly what the panel shows. Portalled to <body>, so
          Ctrl+P from the workspace prints the response rather than the console. */}
      {item && detail && (
        <PrintSheet>
          <div className="p-10">
            <h1 className="text-2xl font-semibold">Response {item.referenceId}</h1>
            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <PrintMeta label="Survey" value={item.surveyTitle} />
              <PrintMeta label="Submitted" value={formatDate(item.submittedAt)} />
              <PrintMeta label="Language" value={languageLabel(item.language)} />
              <PrintMeta label="Completion" value={`${detail.completionPct}% (${detail.answered} of ${detail.total})`} />
              <PrintMeta label="Time taken" value={formatDuration(item.secondsTaken)} />
            </dl>
            <ol className="mt-8 space-y-3">
              {detail.answers.map((a, i) => (
                <li key={a.questionId} className="break-inside-avoid border-b border-black/10 pb-3">
                  <div className="text-sm font-medium">
                    {i + 1}. {a.prompt}
                  </div>
                  <div className="mt-1 text-sm font-semibold">{a.answer ?? "Not answered"}</div>
                </li>
              ))}
            </ol>
            <p className="mt-8 flex items-center gap-2 text-xs opacity-70">
              <FileText className="h-3.5 w-3.5" /> Jeevana Insight · Family assessment research
            </p>
          </div>
        </PrintSheet>
      )}
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="eyebrow">{label}</span>
      <span className="t-caption font-medium text-foreground">{value}</span>
    </span>
  );
}

function PrintMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="font-semibold">{label}:</dt>
      <dd>{value}</dd>
    </div>
  );
}

export { formatDate as formatResponseDate, languageLabel };
export const LanguageBadge = ({ code }: { code: string }) => (
  <Badge variant={code === "te" ? "default" : "secondary"}>{languageLabel(code)}</Badge>
);
