import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Inbox, ChevronLeft, ChevronRight, ArrowRight, Loader2, FileText, CheckCircle2, MinusCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { listResponses, getResponseDetail, type ResponseListItem } from "@/lib/responseExplorer";
import { useLangMode, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export default function ResponseExplorer() {
  const t = useT();
  const mode = useLangMode();
  const [search, setSearch] = useState("");
  const [surveyFilter, setSurveyFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<ResponseListItem | null>(null);

  const { data: rows, isPending, isError } = useQuery({ queryKey: ["all-responses"], queryFn: listResponses });

  // The survey dropdown is built from the responses that actually exist, so it
  // never lists a survey with nothing to show.
  const surveys = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows ?? []) map.set(r.surveyId, r.surveyTitle);
    return Array.from(map.entries());
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (surveyFilter !== "all" && r.surveyId !== surveyFilter) return false;
      if (langFilter !== "all" && r.language !== langFilter) return false;
      if (needle && !r.referenceId.toLowerCase().includes(needle) && !r.surveyTitle.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, search, surveyFilter, langFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const resetPage = () => setPage(0);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupInsights")}
        title={t("navResponseExplorer")}
        subtitle="Open any single family's submission — reference ID, date, language, and every answer, exactly as it was given."
      />

      {/* Filters */}
      <div className="mt-6 grid gap-3 rounded-surface border border-border/70 bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" strokeWidth={1.5} />
          <Input
            placeholder="Search by reference ID or survey…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="h-11 pl-9"
          />
        </div>
        <Select
          value={surveyFilter}
          onValueChange={(v) => {
            setSurveyFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="h-11 sm:w-56">
            <SelectValue placeholder="All surveys" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All surveys</SelectItem>
            {surveys.map(([id, title]) => (
              <SelectItem key={id} value={id}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={langFilter}
          onValueChange={(v) => {
            setLangFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="h-11 sm:w-36">
            <SelectValue placeholder="Any language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any language</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="te">Telugu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-surface border border-border/70 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="eyebrow px-5 py-3 font-semibold">Reference</th>
                <th className="eyebrow px-5 py-3 font-semibold">Survey</th>
                <th className="eyebrow px-5 py-3 font-semibold">Submitted</th>
                <th className="eyebrow px-5 py-3 font-semibold">Language</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isPending ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-28" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-40" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-5 w-16 rounded-pill" /></td>
                    <td className="px-5 py-3.5" />
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center t-body text-muted-foreground">
                    Couldn't load responses. Please reload the page.
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16">
                    <div className="mx-auto grid max-w-xs place-items-center text-center">
                      <span className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
                        <Inbox className="h-6 w-6 text-primary" strokeWidth={1.5} />
                      </span>
                      <p className="mt-4 t-section">{filtered.length === 0 && (rows?.length ?? 0) > 0 ? "No matching responses" : "No responses yet"}</p>
                      <p className="mt-2 t-body text-muted-foreground">
                        {filtered.length === 0 && (rows?.length ?? 0) > 0
                          ? "Try a different search or filter."
                          : "Submitted responses will appear here as families complete surveys."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer transition-colors duration-fast hover:bg-sunken"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-sm font-semibold tracking-wide">{r.referenceId}</td>
                    <td className="max-w-xs truncate px-5 py-3.5 t-body">{r.surveyTitle}</td>
                    <td className="whitespace-nowrap px-5 py-3.5 t-caption text-muted-foreground">{formatDate(r.submittedAt)}</td>
                    <td className="px-5 py-3.5">
                      <Badge variant={r.language === "te" ? "default" : "secondary"}>{r.language === "te" ? "Telugu" : "English"}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" strokeWidth={1.7} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!isPending && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3">
            <span className="t-caption text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)}
              </span>{" "}
              of <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                <ChevronLeft strokeWidth={1.8} />
                Previous
              </Button>
              <span className="px-2 t-caption tabular-nums text-muted-foreground">
                {safePage + 1} / {pageCount}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                disabled={safePage >= pageCount - 1}
              >
                Next
                <ChevronRight strokeWidth={1.8} />
              </Button>
            </div>
          </div>
        )}
      </div>

      <ResponseDetailDialog item={selected} mode={mode} onClose={() => setSelected(null)} />
    </PageContainer>
  );
}

function ResponseDetailDialog({ item, mode, onClose }: { item: ResponseListItem | null; mode: "en" | "te"; onClose: () => void }) {
  const { data: detail, isPending } = useQuery({
    queryKey: ["response-detail", item?.id, mode],
    queryFn: () => getResponseDetail(item!.id, item!.surveyId, mode),
    enabled: !!item,
  });

  return (
    <Dialog open={!!item} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {item && (
          <>
            <DialogHeader className="border-b border-border px-6 py-5">
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" strokeWidth={1.6} />
                Response {item.referenceId}
              </DialogTitle>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 t-caption text-muted-foreground">
                <span className="truncate font-medium text-foreground">{item.surveyTitle}</span>
                <span>{formatDate(item.submittedAt)}</span>
                <Badge variant={item.language === "te" ? "default" : "secondary"}>
                  {item.language === "te" ? "Telugu" : "English"}
                </Badge>
                {detail && (
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-success" strokeWidth={2} />
                    {detail.answered} / {detail.total} answered
                  </span>
                )}
              </div>
            </DialogHeader>

            <div className="max-h-[calc(85vh-6rem)] overflow-y-auto px-6 py-4 thin-scrollbar">
              {isPending ? (
                <div className="space-y-4 py-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-5 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : !detail ? (
                <p className="py-8 text-center t-body text-muted-foreground">Couldn't load this response.</p>
              ) : (
                <ol className="divide-y divide-border">
                  {detail.answers.map((a, i) => (
                    <li key={a.questionId} className="flex gap-3.5 py-3.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-pill bg-muted t-caption font-bold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="t-body font-medium leading-snug">{a.prompt}</div>
                        <div
                          className={cn(
                            "mt-1 t-body",
                            a.answer ? "font-semibold text-primary" : "inline-flex items-center gap-1.5 text-muted-foreground",
                          )}
                        >
                          {a.answer ?? (
                            <>
                              <MinusCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                              Not answered
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
        {/* Keeps the loader off an empty dialog frame during the open animation */}
        {item && isPending && (
          <span className="sr-only">
            <Loader2 className="animate-spin" /> Loading
          </span>
        )}
      </DialogContent>
    </Dialog>
  );
}
