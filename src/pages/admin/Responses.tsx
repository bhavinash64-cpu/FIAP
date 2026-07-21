import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Gauge,
  Inbox,
  Plus,
  QrCode,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { EmptyState, EmptyInboxArt } from "@/components/admin/EmptyState";
import { StatTile } from "@/components/admin/StatTile";
import { SearchInput, Toolbar } from "@/components/admin/Toolbar";
import { StatusBadge } from "@/components/survey/StatusBadge";
import {
  LanguageBadge,
  ResponseInspector,
  formatResponseDate,
} from "@/components/responses/ResponseInspector";
import { ResponseExportDialog } from "@/components/responses/ResponseExportDialog";
import {
  getAnswerCounts,
  getResponseDetail,
  getSurveyResponseSummaries,
  listResponses,
  type ResponseListItem,
  type SurveyResponseSummary,
} from "@/lib/responseExplorer";
import { listSurveys } from "@/lib/surveys";
import { formatDuration } from "@/lib/reports";
import { useLangMode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The Responses workspace — the merge of what used to be two pages, "Responses"
 * (a list of surveys and their counts) and "Response Explorer" (a table of
 * individual submissions that opened a modal). Splitting those was the single
 * worst piece of navigation in the console: the same question ("what came in?")
 * answered on two screens, neither of which could answer it alone.
 *
 * Everything now happens here. The survey cards are a FILTER, not a link; a row
 * opens an inspector rather than a route. The only network calls are the two
 * shared queries at the top — every filter, search and statistic below is
 * computed synchronously over that cache.
 */

const PAGE_SIZE = 20;

type RangeKey = "all" | "7d" | "30d" | "90d";

const RANGES: { key: RangeKey; label: string; days: number | null }[] = [
  { key: "all", label: "All time", days: null },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
];

export default function Responses() {
  const mode = useLangMode();
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();

  const {
    data: rows,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ["all-responses"], queryFn: listResponses });
  const { data: surveys } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });
  const { data: summaries } = useQuery({
    queryKey: ["survey-response-summaries"],
    queryFn: getSurveyResponseSummaries,
  });

  const [search, setSearch] = useState("");
  const [surveyFilter, setSurveyFilter] = useState("all");
  const [langFilter, setLangFilter] = useState("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  const advancedCount = (langFilter !== "all" ? 1 : 0) + (range !== "all" ? 1 : 0);
  const anyFilter = advancedCount > 0 || surveyFilter !== "all" || search.trim() !== "";

  // Every filter change re-slices the same array, so the page index must come
  // back to the top or the user lands on an empty tail.
  useEffect(() => setPage(0), [search, surveyFilter, langFilter, range]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rangeDays = RANGES.find((r) => r.key === range)?.days ?? null;
    const floor = rangeDays ? Date.now() - rangeDays * 86400000 : null;

    return (rows ?? []).filter((r) => {
      if (surveyFilter !== "all" && r.surveyId !== surveyFilter) return false;
      if (langFilter !== "all" && r.language !== langFilter) return false;
      if (floor && new Date(r.submittedAt).getTime() < floor) return false;
      if (needle && !r.referenceId.toLowerCase().includes(needle) && !r.surveyTitle.toLowerCase().includes(needle)) {
        return false;
      }
      return true;
    });
  }, [rows, search, surveyFilter, langFilter, range]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage],
  );

  // Completion needs an answer count per response and there is no grouped
  // aggregate to ask for — so it is fetched for the visible page only. Twenty
  // ids is a few hundred rows regardless of how big the account gets.
  const pageIds = useMemo(() => pageRows.map((r) => r.id), [pageRows]);
  const { data: answerCounts } = useQuery({
    queryKey: ["answer-counts", pageIds],
    queryFn: () => getAnswerCounts(pageIds),
    enabled: pageIds.length > 0,
    placeholderData: (prev) => prev,
  });

  const questionCountBySurvey = useMemo(
    () => new Map((surveys ?? []).map((s) => [s.id, s.question_count])),
    [surveys],
  );

  const stats = useMemo(() => {
    const scoped = filtered;
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const today = scoped.filter((r) => new Date(r.submittedAt) >= startToday).length;
    const timings = scoped.map((r) => r.secondsTaken).filter((s): s is number => s != null);
    const relevant =
      surveyFilter === "all" ? summaries ?? [] : (summaries ?? []).filter((s) => s.id === surveyFilter);
    const rated = relevant.filter((s) => s.completionRate != null && s.responseCount > 0);
    const weight = rated.reduce((n, s) => n + s.responseCount, 0);
    return {
      total: scoped.length,
      today,
      avgSeconds: timings.length ? Math.round(timings.reduce((n, s) => n + s, 0) / timings.length) : null,
      completion: weight
        ? rated.reduce((n, s) => n + (s.completionRate as number) * s.responseCount, 0) / weight
        : null,
    };
  }, [filtered, summaries, surveyFilter]);

  const selectedIndex = selectedId ? filtered.findIndex((r) => r.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  /** Warm the answer sheet before the click lands — the drawer usually opens full. */
  const prefetchDetail = useCallback(
    (r: ResponseListItem) => {
      void qc.prefetchQuery({
        queryKey: ["response-detail", r.id, mode],
        queryFn: () => getResponseDetail(r.id, r.surveyId, mode),
      });
    },
    [qc, mode],
  );

  const openResponse = useCallback((r: ResponseListItem) => setSelectedId(r.id), []);

  // Deep link from the dashboard's "Latest responses". An id that no longer
  // exists (deleted survey, stale bookmark) drops the param rather than leaving
  // a drawer spinning on nothing.
  const deepLinkId = params.get("r");
  useEffect(() => {
    if (!deepLinkId || !rows) return;
    const hit = rows.find((r) => r.id === deepLinkId);
    if (hit) setSelectedId(hit.id);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("r");
        return next;
      },
      { replace: true },
    );
  }, [deepLinkId, rows, setParams]);

  function clearFilters() {
    setSearch("");
    setSurveyFilter("all");
    setLangFilter("all");
    setRange("all");
  }

  const hasSurveys = (surveys?.length ?? 0) > 0;
  const hasAnyResponses = (rows?.length ?? 0) > 0;

  // The summaries query is the one that always carries a display title; the
  // survey list and the response rows are fallbacks for the window between
  // caches resolving, so the export dialog is never labelled with a raw id.
  const exportSurveyTitle = useMemo(() => {
    if (surveyFilter === "all") return "All surveys";
    return (
      (summaries ?? []).find((s) => s.id === surveyFilter)?.title ??
      (surveys ?? []).find((s) => s.id === surveyFilter)?.title_en ??
      (rows ?? []).find((r) => r.surveyId === surveyFilter)?.surveyTitle ??
      "Selected survey"
    );
  }, [surveyFilter, summaries, surveys, rows]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Insights"
        title="Responses"
        subtitle="Every submission in one place — scan the table, open any family's answer sheet, and export the survey you are looking at without leaving the page."
        actions={
          // Export runs here rather than on /app/export so the filters an
          // administrator already set up are the ones that get exported —
          // walking to another page meant re-picking them and getting a
          // different file.
          hasAnyResponses ? (
            <Button onClick={() => setExportOpen(true)}>
              <Download strokeWidth={1.6} /> Export
            </Button>
          ) : null
        }
      />

      {isError ? (
        <div className="mt-8 rounded-surface border border-danger/30 bg-danger/5 p-6 text-center">
          <p className="t-body font-medium">Couldn't load responses.</p>
          <p className="mt-1 t-caption text-muted-foreground">The data may still be there — this was a network or permission error, not an empty account.</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <LoadingSkeleton />
      ) : !hasAnyResponses ? (
        <div className="mt-6 rounded-surface border border-border/70 bg-card">
          <EmptyState
            illustration={<EmptyInboxArt />}
            title="No responses collected yet."
            description={
              hasSurveys
                ? "Publish a survey and share the QR code to begin collecting research data."
                : "Create and publish a survey, then share its QR code to begin collecting research data."
            }
            primaryAction={
              <Button asChild>
                <Link to="/app/surveys">
                  <Plus strokeWidth={1.6} /> Publish survey
                </Link>
              </Button>
            }
            secondaryAction={
              <Button asChild variant="outline">
                <Link to="/app/qr">
                  <QrCode strokeWidth={1.6} /> Open QR manager
                </Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          {/* Summary — scoped to whatever is filtered, so the numbers always
              describe what the table below is showing. */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile icon={Inbox} label="Responses" value={stats.total} sub={surveyFilter === "all" ? "all surveys" : "selected survey"} tone="primary" />
            <StatTile icon={Sparkles} label="Today" value={stats.today} sub="since midnight" />
            <StatTile
              icon={Gauge}
              label="Completion"
              value={stats.completion == null ? "—" : `${Math.round(stats.completion * 100)}%`}
              sub="submitted vs opened"
            />
            <StatTile icon={Clock3} label="Avg time" value={formatDuration(stats.avgSeconds)} sub="to complete" />
          </div>

          {/* Survey cards — a filter, not a link. */}
          {(summaries?.length ?? 0) > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              <AllSurveysCard
                active={surveyFilter === "all"}
                total={rows?.length ?? 0}
                surveys={summaries?.length ?? 0}
                onSelect={() => setSurveyFilter("all")}
              />
              {(summaries ?? [])
                .filter((s) => s.responseCount > 0 || s.status === "published")
                .map((s) => (
                  <SurveyCard
                    key={s.id}
                    summary={s}
                    active={surveyFilter === s.id}
                    onSelect={() => setSurveyFilter(surveyFilter === s.id ? "all" : s.id)}
                  />
                ))}
            </div>
          )}

          <Toolbar
            className="mt-4"
            search={
              <SearchInput
                value={search}
                onChange={setSearch}
                label="Search responses"
                placeholder="Search by reference ID or survey…"
              />
            }
          >
            <Select value={surveyFilter} onValueChange={setSurveyFilter}>
              <SelectTrigger className="h-10 w-[13rem]">
                <SelectValue placeholder="All surveys" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All surveys</SelectItem>
                {(summaries ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-10">
                  <Filter className="h-3.5 w-3.5" strokeWidth={1.7} />
                  Filters
                  {advancedCount > 0 && (
                    <Badge variant="default" className="ml-1 h-5 min-w-5 justify-center px-1.5 tabular-nums">
                      {advancedCount}
                    </Badge>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 space-y-3">
                <label className="block">
                  <span className="eyebrow">Language</span>
                  <Select value={langFilter} onValueChange={setLangFilter}>
                    <SelectTrigger className="mt-1.5 h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any language</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="te">Telugu</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label className="block">
                  <span className="eyebrow">Submitted</span>
                  <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
                    <SelectTrigger className="mt-1.5 h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGES.map((r) => (
                        <SelectItem key={r.key} value={r.key}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                {advancedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      setLangFilter("all");
                      setRange("all");
                    }}
                  >
                    Reset these filters
                  </Button>
                )}
              </PopoverContent>
            </Popover>

            {anyFilter && (
              <Button variant="ghost" className="h-10" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </Toolbar>

          {filtered.length === 0 ? (
            <div className="mt-3 rounded-surface border border-border/70 bg-card">
              <EmptyState
                compact
                icon={Inbox}
                title="No matching responses"
                description="Nothing in the collected data matches this combination of filters."
                primaryAction={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-surface border border-border/70 bg-card">
              {/* Desktop table */}
              <table className="hidden w-full md:table">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-left">
                    <th className="eyebrow px-5 py-2.5 font-semibold">Reference</th>
                    <th className="eyebrow px-5 py-2.5 font-semibold">Survey</th>
                    <th className="eyebrow px-5 py-2.5 font-semibold">Submitted</th>
                    <th className="eyebrow px-5 py-2.5 font-semibold">Language</th>
                    <th className="eyebrow px-5 py-2.5 font-semibold">Completion</th>
                    <th className="w-10 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pageRows.map((r) => {
                    const answered = answerCounts?.get(r.id);
                    const total = questionCountBySurvey.get(r.surveyId) ?? 0;
                    return (
                      <tr
                        key={r.id}
                        tabIndex={0}
                        role="button"
                        aria-label={`Open response ${r.referenceId}`}
                        onClick={() => openResponse(r)}
                        onMouseEnter={() => prefetchDetail(r)}
                        onFocus={() => prefetchDetail(r)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            openResponse(r);
                          }
                        }}
                        className="cursor-pointer transition-colors duration-fast hover:bg-sunken focus:outline-none focus-visible:bg-sunken focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <td className="whitespace-nowrap px-5 py-3 font-mono text-sm font-semibold tracking-wide">{r.referenceId}</td>
                        <td className="max-w-[18rem] truncate px-5 py-3 t-body">{r.surveyTitle}</td>
                        <td className="whitespace-nowrap px-5 py-3 t-caption text-muted-foreground">{formatResponseDate(r.submittedAt)}</td>
                        <td className="px-5 py-3">
                          <LanguageBadge code={r.language} />
                        </td>
                        <td className="px-5 py-3">
                          <CompletionCell answered={answered} total={total} />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <ChevronRight className="ml-auto h-4 w-4 text-tertiary" strokeWidth={1.8} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Phones: a five-column table is unreadable, so the same rows
                  stack into cards with the identifying facts first. */}
              <ul className="divide-y divide-border md:hidden">
                {pageRows.map((r) => {
                  const answered = answerCounts?.get(r.id);
                  const total = questionCountBySurvey.get(r.surveyId) ?? 0;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => openResponse(r)}
                        onTouchStart={() => prefetchDetail(r)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-sunken"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block font-mono text-sm font-semibold tracking-wide">{r.referenceId}</span>
                          <span className="mt-0.5 block truncate t-caption text-muted-foreground">{r.surveyTitle}</span>
                          <span className="mt-1 flex items-center gap-2 t-caption text-tertiary">
                            {formatResponseDate(r.submittedAt)}
                            <CompletionCell answered={answered} total={total} compact />
                          </span>
                        </span>
                        <LanguageBadge code={r.language} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-tertiary" strokeWidth={1.8} />
                      </button>
                    </li>
                  );
                })}
              </ul>

              {filtered.length > PAGE_SIZE && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-2.5">
                  <span className="t-caption text-muted-foreground">
                    Showing{" "}
                    <span className="font-semibold tabular-nums text-foreground">
                      {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)}
                    </span>{" "}
                    of <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={safePage === 0}>
                      <ChevronLeft strokeWidth={1.8} /> Previous
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
                      Next <ChevronRight strokeWidth={1.8} />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <ResponseInspector
        item={selected}
        mode={mode}
        onClose={() => setSelectedId(null)}
        onPrev={selectedIndex > 0 ? () => setSelectedId(filtered[selectedIndex - 1].id) : undefined}
        onNext={
          selectedIndex >= 0 && selectedIndex < filtered.length - 1
            ? () => setSelectedId(filtered[selectedIndex + 1].id)
            : undefined
        }
        positionLabel={selectedIndex >= 0 ? `${selectedIndex + 1} / ${filtered.length}` : undefined}
      />

      <ResponseExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        surveyId={surveyFilter}
        surveyTitle={exportSurveyTitle}
        rowCount={filtered.length}
      />
    </PageContainer>
  );
}

function CompletionCell({ answered, total, compact }: { answered?: number; total: number; compact?: boolean }) {
  if (answered == null || total === 0) {
    return <span className={cn("text-tertiary", compact ? "t-caption" : "t-caption")}>—</span>;
  }
  const pct = Math.min(100, Math.round((answered / total) * 100));
  if (compact) return <span className="t-caption tabular-nums">{pct}%</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-pill bg-sunken">
        <span
          className={cn("block h-full rounded-pill", pct >= 100 ? "bg-success" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="t-caption tabular-nums text-muted-foreground">{pct}%</span>
    </span>
  );
}

function AllSurveysCard({
  active,
  total,
  surveys,
  onSelect,
}: {
  active: boolean;
  total: number;
  surveys: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col justify-between rounded-surface border p-4 text-left transition-colors duration-fast",
        active ? "border-primary bg-primary-tint/50" : "border-border/70 bg-card hover:border-border-strong hover:bg-sunken",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-control bg-accent-tint text-primary">
          <Inbox className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="t-card">All surveys</span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="t-section tabular-nums leading-none">{total}</span>
        <span className="t-caption text-muted-foreground">responses across {surveys}</span>
      </div>
    </button>
  );
}

/**
 * Deliberately five facts: name, status, responses, completion, last response.
 * Question count is gone — it says nothing about collection progress and it was
 * the noisiest thing on the card.
 */
function SurveyCard({
  summary,
  active,
  onSelect,
}: {
  summary: SurveyResponseSummary;
  active: boolean;
  onSelect: () => void;
}) {
  const last = summary.lastResponseAt
    ? new Date(summary.lastResponseAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        "flex flex-col rounded-surface border p-4 text-left transition-colors duration-fast",
        active ? "border-primary bg-primary-tint/50" : "border-border/70 bg-card hover:border-border-strong hover:bg-sunken",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 t-card leading-snug">{summary.title}</span>
        <StatusBadge status={summary.status} className="shrink-0" />
      </div>
      <dl className="mt-3 flex items-end justify-between gap-3">
        <div>
          <dd className="t-section tabular-nums leading-none">{summary.responseCount}</dd>
          <dt className="mt-1 t-caption text-tertiary">responses</dt>
        </div>
        <div className="text-right">
          <dd className="t-caption font-semibold tabular-nums">
            {summary.completionRate == null ? "—" : `${Math.round(summary.completionRate * 100)}%`}
          </dd>
          <dt className="t-caption text-tertiary">completion</dt>
        </div>
        <div className="text-right">
          <dd className="t-caption font-semibold tabular-nums">{last}</dd>
          <dt className="t-caption text-tertiary">last</dt>
        </div>
      </dl>
    </button>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[5.25rem] rounded-surface" />
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[7rem] rounded-surface" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-surface" />
      <Skeleton className="h-80 rounded-surface" />
    </div>
  );
}
