import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Copy,
  Hourglass,
  MoreHorizontal,
  Plus,
  Printer,
  TimerOff,
  Users,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { EmptyState, EmptySurveyArt } from "@/components/admin/EmptyState";
import { StatTile } from "@/components/admin/StatTile";
import { SearchInput, Toolbar } from "@/components/admin/Toolbar";
import { CASE_STATUS_LABEL_KEYS, CaseStatusBadge } from "@/components/family/CaseStatusBadge";
import { CaseSlipSheet } from "@/components/family/CaseSlipSheet";
import { FamilyCaseDialog } from "@/components/family/FamilyCaseDialog";
import { FamilyCaseInspector } from "@/components/family/FamilyCaseInspector";
import { renderBilingual, useLangMode, useT } from "@/lib/i18n";
import { printSheetOnly } from "@/lib/share";
import {
  CASE_STATUSES,
  daysUntil,
  familyLinkUrl,
  formatPhone,
  getFamilyCaseStats,
  listFamilyCases,
  type FamilyCaseRow,
  type FamilyCaseStatus,
} from "@/lib/familyCases";
import { readFollowUpPlan, runDueFollowUps } from "@/lib/familyFollowups";
import { cn } from "@/lib/utils";

/**
 * The caseload — every family an officer has enrolled, and how far each has got.
 *
 * The rule it follows: one fetch, then everything else is arithmetic. This list
 * is a district's caseload, not a warehouse, so the search, the four filters and
 * the needs-attention chips all run synchronously over the same cached array.
 * Nothing here goes back to the network to answer a question the client can
 * already answer.
 *
 * The one exception is the follow-up sweep below, which is a write, not a read.
 */

export default function FamilyCases() {
  const t = useT();
  const mode = useLangMode();
  const qc = useQueryClient();

  const {
    data: rows,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: ["family-cases"], queryFn: listFamilyCases });
  const { data: stats, isPending: statsPending } = useQuery({
    queryKey: ["family-case-stats"],
    queryFn: getFamilyCaseStats,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FamilyCaseStatus>("all");
  const [surveyFilter, setSurveyFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [langFilter, setLangFilter] = useState<"all" | "en" | "te">("all");
  const [attention, setAttention] = useState<AttentionKey | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // There is no scheduler in this deployment, so due follow-up rounds are minted
  // by whoever opens the caseload first. The ref is what stops StrictMode's double
  // mount from running the sweep twice.
  //
  // runDueFollowUps() already absorbs a missing migration on its own; the catch
  // here covers the rest — a signed-in admin who is not a super_admin trips the
  // RPC's has_role guard, and being denied a feature you were not using must not
  // cost you the case list you actually came here to read.
  const sweptRef = useRef(false);
  useEffect(() => {
    if (sweptRef.current) return;
    sweptRef.current = true;
    void (async () => {
      try {
        const created = await runDueFollowUps();
        if (created <= 0) return;
        invalidate();
        toast.success(
          created === 1 ? "1 follow-up round scheduled" : `${created} follow-up rounds scheduled`,
        );
      } catch {
        /* Best-effort — see above. */
      }
    })();
    // Deliberately mount-only: `invalidate` closes over nothing but the stable
    // query client, and re-running the sweep on every render would mint rounds
    // in a loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The printable slip is rendered on demand for one row. The nonce is what lets
  // the same row be printed twice — without it the second click is a no-op
  // because the state never changes.
  const [slip, setSlip] = useState<{ row: FamilyCaseRow; nonce: number } | null>(null);
  useEffect(() => {
    if (!slip) return;
    // Unmounted again once the job is away. A sheet left mounted is a second
    // `.print-sheet` in <body>, and the create dialog portals one of its own —
    // leaving this one behind means the next print emits two families' slips.
    const done = () => setSlip(null);
    window.addEventListener("afterprint", done);
    const frame = requestAnimationFrame(() => printSheetOnly());
    return () => {
      window.removeEventListener("afterprint", done);
      cancelAnimationFrame(frame);
    };
  }, [slip]);

  const surveyOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows ?? []) {
      if (!seen.has(r.survey_id)) seen.set(r.survey_id, renderBilingual(mode, r.survey_title_en, r.survey_title_te).primary);
    }
    return [...seen].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title));
  }, [rows, mode]);

  const districtOptions = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.district).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );

  // Everything except the attention chips. Their counts are read off this list so
  // that toggling a chip never changes the number printed on the other one — a
  // count that moved when you pressed it would be unreadable.
  const scoped = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (surveyFilter !== "all" && r.survey_id !== surveyFilter) return false;
      if (districtFilter !== "all" && r.district !== districtFilter) return false;
      if (langFilter !== "all" && r.preferred_language !== langFilter) return false;
      if (!needle) return true;
      return [r.reference_id, r.family_head_name, r.deceased_name, r.phone, r.district, r.village ?? ""].some((f) =>
        f.toLowerCase().includes(needle),
      );
    });
  }, [rows, search, statusFilter, surveyFilter, districtFilter, langFilter]);

  const attentionCounts = useMemo(
    () => ({
      expiring: scoped.filter((r) => isExpiringSoon(r)).length,
      stalled: scoped.filter((r) => isStalled(r)).length,
    }),
    [scoped],
  );

  const filtered = useMemo(() => {
    if (!attention) return scoped;
    const test = attention === "expiring" ? isExpiringSoon : isStalled;
    return scoped.filter(test);
  }, [scoped, attention]);

  const anyFilter =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    surveyFilter !== "all" ||
    districtFilter !== "all" ||
    langFilter !== "all" ||
    attention !== null;

  const selectedIndex = selectedId ? filtered.findIndex((r) => r.id === selectedId) : -1;
  const selected = selectedIndex >= 0 ? filtered[selectedIndex] : null;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setSurveyFilter("all");
    setDistrictFilter("all");
    setLangFilter("all");
    setAttention(null);
  }

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["family-cases"] });
    void qc.invalidateQueries({ queryKey: ["family-case-stats"] });
  }

  async function copyLink(row: FamilyCaseRow) {
    try {
      await navigator.clipboard.writeText(familyLinkUrl(row.access_token));
      toast.success(t("copied"));
    } catch {
      toast.error(t("somethingWrongTitle"));
    }
  }

  /*
    No export from this page. Exporting is one job with one home — Responses —
    and a second, subtly different export button here is how two files that
    disagree end up in the same appendix. This page is for running the caseload.
  */

  const hasAny = (rows?.length ?? 0) > 0;

  const createButton = (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus strokeWidth={1.7} />
      {t("caseNew")}
    </Button>
  );

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupField")}
        title={t("casesTitle")}
        subtitle={t("casesSubtitle")}
        actions={createButton}
      />

      {isError ? (
        <div className="mt-8 rounded-surface border border-danger/30 bg-danger/5 p-6 text-center">
          <p className="t-body font-medium">{t("somethingWrongTitle")}</p>
          <p className="mt-1 t-caption text-muted-foreground">{t("somethingWrongBody")}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void refetch()}>
            {t("refresh")}
          </Button>
        </div>
      ) : isPending ? (
        <LoadingSkeleton />
      ) : !hasAny ? (
        <div className="mt-6 rounded-surface border border-border/70 bg-card">
          <EmptyState
            illustration={<EmptySurveyArt />}
            title={t("caseNoneTitle")}
            description={t("caseNoneBody")}
            primaryAction={createButton}
            secondaryAction={
              <Button asChild variant="outline">
                <Link to="/app/surveys">{t("navSurveys")}</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile icon={Users} label="Total cases" value={stats?.total ?? 0} sub="enrolled families" tone="primary" loading={statsPending} />
            <StatTile icon={Activity} label={t("statusInProgress")} value={stats?.inProgress ?? 0} sub="answering now" loading={statsPending} />
            <StatTile icon={CheckCircle2} label={t("statusCompleted")} value={stats?.completed ?? 0} sub="submitted" loading={statsPending} />
            <StatTile icon={CalendarCheck} label="Completed today" value={stats?.completedToday ?? 0} sub="since midnight" loading={statsPending} />
            <StatTile icon={TimerOff} label={t("statusExpired")} value={stats?.expired ?? 0} sub="need reissue" loading={statsPending} />
          </div>

          <Toolbar
            className="mt-4"
            search={
              <SearchInput
                value={search}
                onChange={setSearch}
                label={t("search")}
                placeholder={t("caseSearchPlaceholder")}
              />
            }
            /*
              No export here on purpose. Exporting is one job with one home —
              Responses — and offering a second, subtly different export from the
              case list is how two files that disagree end up in the same thesis
              appendix. This page is for running the caseload.
            */
          >
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | FamilyCaseStatus)}>
              <SelectTrigger className="h-10 w-[10.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {CASE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(CASE_STATUS_LABEL_KEYS[s])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={surveyFilter} onValueChange={setSurveyFilter}>
              <SelectTrigger className="h-10 w-[13rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assessments</SelectItem>
                {surveyOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={districtFilter} onValueChange={setDistrictFilter}>
              <SelectTrigger className="h-10 w-[10.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All districts</SelectItem>
                {districtOptions.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={langFilter} onValueChange={(v) => setLangFilter(v as "all" | "en" | "te")}>
              <SelectTrigger className="h-10 w-[9.5rem]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any language</SelectItem>
                <SelectItem value="te">{t("telugu")}</SelectItem>
                <SelectItem value="en">{t("english")}</SelectItem>
              </SelectContent>
            </Select>

            {anyFilter && (
              <Button variant="ghost" className="h-10" onClick={clearFilters}>
                Clear all
              </Button>
            )}
          </Toolbar>

          {/* The two questions an officer opens this page to answer. Both are
              arithmetic over the rows already in hand, so neither costs a query,
              and a chip whose count is zero is removed rather than greyed — a row
              of zeroes trains people to stop reading the row. */}
          <AttentionChips
            counts={attentionCounts}
            active={attention}
            onToggle={(key) => setAttention((prev) => (prev === key ? null : key))}
          />

          {filtered.length === 0 ? (
            <div className="mt-3 rounded-surface border border-border/70 bg-card">
              <EmptyState
                compact
                icon={Users}
                title="No matching cases"
                description="No family in the caseload matches this combination of filters."
                primaryAction={
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="mt-3 overflow-hidden rounded-surface border border-border/70 bg-card">
              {/* Nine columns on a phone is a horizontal-scroll trap, so below md
                  the same rows become cards carrying only the four facts an
                  officer scans for: who, where they are up to, and how to reach
                  them. The table is not made narrower — it is replaced. */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("referenceId")}</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("caseFamilyHead")}</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("casePhone")}</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("caseSurvey")}</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("language")}</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">Status</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("caseSubmittedOn")}</TableHead>
                      <TableHead className="eyebrow h-9 px-4 font-semibold text-tertiary">{t("caseOfficer")}</TableHead>
                      <TableHead className="h-9 w-12 px-3" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => {
                      const title = renderBilingual(mode, r.survey_title_en, r.survey_title_te).primary;
                      return (
                        <TableRow
                          key={r.id}
                          // The row stays a ROW. `role="button"` here would make
                          // its cells presentational, so a screen reader would be
                          // told "Open case FC-0007" and nothing else — the eight
                          // columns of density this page exists for would vanish.
                          // The labelled per-row menu is the named control; the
                          // tab stop is the sighted keyboard user's shortcut to it.
                          tabIndex={0}
                          onClick={() => setSelectedId(r.id)}
                          onKeyDown={(e) => {
                            // Only when the ROW itself holds focus. Radix's menu
                            // trigger and its portalled items neither stop nor
                            // consume their Enter/Space keydown, and a portal still
                            // bubbles through the React tree — without this guard,
                            // opening the actions menu from the keyboard also
                            // opened the inspector behind it.
                            if (e.target !== e.currentTarget) return;
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(r.id);
                            }
                          }}
                          className="cursor-pointer border-border hover:bg-sunken focus:outline-none focus-visible:bg-sunken focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                        >
                          <TableCell className="whitespace-nowrap px-4 py-2 font-mono text-sm font-medium tabular-nums tracking-wide">
                            <span className="flex items-center gap-1.5">
                              {r.reference_id}
                              <RoundBadge row={r} />
                            </span>
                          </TableCell>
                          <TableCell className="max-w-[12rem] truncate px-4 py-2 t-body" title={r.family_head_name}>
                            {r.family_head_name}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-2 t-body tabular-nums text-muted-foreground">
                            {formatPhone(r.phone)}
                          </TableCell>
                          <TableCell className="max-w-[14rem] truncate px-4 py-2 t-body" title={title}>
                            {title}
                          </TableCell>
                          <TableCell className="px-4 py-2">
                            <LanguagePill code={r.preferred_language} />
                          </TableCell>
                          {/* Status and progress answer one question, so they sit in
                              one cell rather than buying a tenth column. */}
                          <TableCell className="whitespace-nowrap px-4 py-2">
                            <span className="flex items-center gap-2">
                              <CaseStatusBadge status={r.status} />
                              <CompletionMeter pct={r.completion_pct} />
                            </span>
                          </TableCell>
                          <TableCell
                            className="whitespace-nowrap px-4 py-2 t-caption text-muted-foreground"
                            title={r.submitted_at ? formatCaseDate(r.submitted_at) : undefined}
                          >
                            {r.submitted_at ? relativeTime(r.submitted_at) : "—"}
                          </TableCell>
                          <TableCell className="max-w-[11rem] truncate px-4 py-2 t-caption text-muted-foreground" title={r.officer_name ?? ""}>
                            {r.officer_name ?? "—"}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-right">
                            <RowActions
                              row={r}
                              onOpen={() => setSelectedId(r.id)}
                              onCopy={() => void copyLink(r)}
                              onPrint={() => setSlip({ row: r, nonce: Date.now() })}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <ul className="divide-y divide-border md:hidden">
                {filtered.map((r) => (
                  <li key={r.id} className="flex items-center gap-2 pr-2">
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-sunken"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="font-mono text-sm font-medium tabular-nums tracking-wide">{r.reference_id}</span>
                          <RoundBadge row={r} />
                          <CaseStatusBadge status={r.status} />
                          <CompletionMeter pct={r.completion_pct} />
                        </span>
                        <span className="mt-1 block truncate t-body">{r.family_head_name}</span>
                        <span className="mt-0.5 block truncate t-caption text-tertiary">
                          {formatPhone(r.phone)} · {r.village ? `${r.village}, ` : ""}
                          {r.district}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-tertiary" strokeWidth={1.8} />
                    </button>
                    <RowActions
                      row={r}
                      onOpen={() => setSelectedId(r.id)}
                      onCopy={() => void copyLink(r)}
                      onPrint={() => setSlip({ row: r, nonce: Date.now() })}
                    />
                  </li>
                ))}
              </ul>

              <div className="border-t border-border px-5 py-2.5 t-caption text-muted-foreground">
                Showing <span className="font-semibold tabular-nums text-foreground">{filtered.length}</span> of{" "}
                <span className="font-semibold tabular-nums text-foreground">{rows?.length ?? 0}</span> cases
              </div>
            </div>
          )}
        </>
      )}

      <FamilyCaseDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(row) => {
          invalidate();
          // Land on the case that was just created rather than making the
          // officer find it in a list they have not yet re-read.
          setSelectedId(row.id);
        }}
      />

      {selected && (
        <FamilyCaseInspector
          caseRow={selected}
          open
          onOpenChange={(o) => {
            if (!o) setSelectedId(null);
          }}
          onChanged={invalidate}
          onPrev={selectedIndex > 0 ? () => setSelectedId(filtered[selectedIndex - 1].id) : undefined}
          onNext={
            selectedIndex >= 0 && selectedIndex < filtered.length - 1
              ? () => setSelectedId(filtered[selectedIndex + 1].id)
              : undefined
          }
          positionLabel={`${selectedIndex + 1} / ${filtered.length}`}
        />
      )}

      {slip && <CaseSlipSheet key={slip.nonce} caseRow={slip.row} />}
    </PageContainer>
  );
}

/**
 * Three actions, not nine. Regenerating a PIN, extending access, reopening and
 * deleting all live in the inspector, where the case is on screen to be read
 * before it is changed.
 */
function RowActions({
  row,
  onOpen,
  onCopy,
  onPrint,
}: {
  row: FamilyCaseRow;
  onOpen: () => void;
  onCopy: () => void;
  onPrint: () => void;
}) {
  const t = useT();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button variant="ghost" size="icon" className="h-11 w-11 lg:h-9 lg:w-9" aria-label={`Actions for ${row.reference_id}`}>
          <MoreHorizontal strokeWidth={1.8} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onOpen}>
          <ChevronRight className="h-4 w-4" strokeWidth={1.7} />
          {t("open")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onCopy}>
          <Copy className="h-4 w-4" strokeWidth={1.7} />
          {t("copyLink")}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onPrint}>
          <Printer className="h-4 w-4" strokeWidth={1.7} />
          {t("casePrintSlip")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LanguagePill({ code }: { code: "en" | "te" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-pill px-2 py-0.5 t-caption font-semibold",
        code === "te" ? "bg-accent-tint text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      {code === "te" ? "తెలుగు" : "EN"}
    </span>
  );
}

/**
 * A case in a longitudinal series carries its round, because "R2/3" is the whole
 * difference between a duplicate family and a second measurement of the same one.
 * One-off cases render nothing — a badge reading "R1/1" on every row would be a
 * column of noise.
 */
function RoundBadge({ row }: { row: FamilyCaseRow }) {
  const plan = readFollowUpPlan(row);
  if (plan.roundsTotal <= 1) return null;
  return (
    <span
      title={`Round ${plan.round} of ${plan.roundsTotal}`}
      className="inline-flex items-center rounded-pill bg-accent-tint px-1.5 py-px font-sans t-caption font-semibold tabular-nums text-primary"
    >
      R{plan.round}/{plan.roundsTotal}
    </span>
  );
}

/**
 * Progress as a 40px track rather than a full-width bar: inside a row this is a
 * glance value, and a wide bar would out-shout the family's name beside it.
 *
 * It appears only once a response exists. A case still being answered has a draft
 * and no `completion_pct` — that figure is computed server-side at submission, and
 * inventing a client-side estimate here would put a second, disagreeing number in
 * front of the same officer.
 */
function CompletionMeter({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const value = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <span className="inline-flex items-center gap-1.5" title={`${value}% of items answered`}>
      <span className="block h-1.5 w-10 overflow-hidden rounded-pill bg-sunken">
        <span
          className={cn("block h-full rounded-pill", value >= 100 ? "bg-success" : "bg-primary")}
          style={{ width: `${value}%` }}
        />
      </span>
      <span className="t-caption font-semibold tabular-nums text-muted-foreground">{value}%</span>
    </span>
  );
}

type AttentionKey = "expiring" | "stalled";

const ATTENTION_WINDOW_DAYS = 7;

/** A live case whose link lapses inside the week: extend it or reissue the slip. */
function isExpiringSoon(row: FamilyCaseRow): boolean {
  if (row.status === "completed" || row.status === "expired") return false;
  return daysUntil(row.expires_at) <= ATTENTION_WINDOW_DAYS;
}

/** Enrolled a week ago and the link has never once been opened — the slip
    probably never reached the family. */
function isStalled(row: FamilyCaseRow): boolean {
  if (row.status !== "not_started") return false;
  return Date.now() - new Date(row.created_at).getTime() > ATTENTION_WINDOW_DAYS * 86_400_000;
}

const ATTENTION_META: Record<AttentionKey, { icon: LucideIcon; label: string }> = {
  expiring: { icon: TimerOff, label: "Expiring within 7 days" },
  stalled: { icon: Hourglass, label: "Not started for over 7 days" },
};

function AttentionChips({
  counts,
  active,
  onToggle,
}: {
  counts: Record<AttentionKey, number>;
  active: AttentionKey | null;
  onToggle: (key: AttentionKey) => void;
}) {
  // A chip stays on screen while it is the active filter even after its count
  // falls to zero, so narrowing the search can never strand an officer on a
  // filter with no way back to it.
  const visible = (Object.keys(ATTENTION_META) as AttentionKey[]).filter(
    (key) => counts[key] > 0 || active === key,
  );
  if (visible.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="eyebrow text-tertiary">Needs attention</span>
      {visible.map((key) => {
        const { icon: Icon, label } = ATTENTION_META[key];
        const on = active === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(key)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-pill border px-3 t-caption font-medium",
              "transition-colors duration-fast ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
              on
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-border-strong hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
            {label}
            <span
              className={cn(
                "rounded-pill px-1.5 font-semibold tabular-nums",
                on ? "bg-primary-foreground/20" : "bg-sunken text-foreground",
              )}
            >
              {counts[key]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function formatCaseDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/** The cell answers "is this fresh?"; the exact date lives in the title attribute,
    where it is available without spending a column on it. */
function relativeTime(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : formatCaseDate(iso);
}

function LoadingSkeleton() {
  return (
    <div className="mt-6 space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[5.25rem] rounded-surface" />
        ))}
      </div>
      <Skeleton className="h-14 rounded-surface" />
      <Skeleton className="h-96 rounded-surface" />
    </div>
  );
}
