import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BellOff,
  ClipboardList,
  Send,
  Lock,
  Trash2,
  Library,
  FileUp,
  Upload,
  RotateCcw,
  Activity,
  Search,
  CheckCheck,
  ScrollText,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/components/admin/PageContainer";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface LogRow {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

type Category = "survey" | "library" | "other";

interface Meta {
  icon: LucideIcon;
  verb: string;
  tone: "primary" | "success" | "warning" | "danger" | "muted";
  category: Category;
}

const ACTION_META: Record<string, Meta> = {
  "survey.create": { icon: ClipboardList, verb: "Created a survey", tone: "primary", category: "survey" },
  "survey.publish": { icon: Send, verb: "Published a survey", tone: "success", category: "survey" },
  "survey.close": { icon: Lock, verb: "Closed a survey", tone: "warning", category: "survey" },
  "survey.reopen": { icon: RotateCcw, verb: "Reopened a survey", tone: "primary", category: "survey" },
  "survey.delete": { icon: Trash2, verb: "Deleted a survey", tone: "danger", category: "survey" },
  "question.import.pdf": { icon: FileUp, verb: "Imported questions from a PDF", tone: "primary", category: "survey" },
  "question.import.voice": { icon: Upload, verb: "Added a question by voice", tone: "primary", category: "survey" },
  "question.import.library": { icon: Library, verb: "Imported questions from the library", tone: "primary", category: "library" },
  "bank.instrument.create": { icon: Library, verb: "Added a library instrument", tone: "primary", category: "library" },
  "bank.instrument.delete": { icon: Trash2, verb: "Removed a library instrument", tone: "danger", category: "library" },
  "bank.instrument.duplicate": { icon: Library, verb: "Duplicated a library instrument", tone: "primary", category: "library" },
  "bank.item.create": { icon: Library, verb: "Added a question to the library", tone: "primary", category: "library" },
  "bank.item.revert": { icon: RotateCcw, verb: "Reverted a library question", tone: "muted", category: "library" },
};

function metaFor(action: string): Meta {
  if (ACTION_META[action]) return ACTION_META[action];
  const verb = action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  const category: Category = action.startsWith("bank.") ? "library" : action.startsWith("survey.") ? "survey" : "other";
  return { icon: Activity, verb, tone: "muted", category };
}

const TONE_CLASS: Record<Meta["tone"], string> = {
  primary: "bg-accent-tint text-primary",
  success: "bg-[hsl(var(--success)/0.12)] text-success",
  warning: "bg-[hsl(var(--warning)/0.14)] text-warning",
  danger: "bg-[hsl(var(--danger)/0.12)] text-danger",
  muted: "bg-muted text-muted-foreground",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function absoluteTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** The five timeline sections, newest first. */
const SECTIONS = ["Today", "Yesterday", "Earlier this week", "Last week", "Older"] as const;
type Section = (typeof SECTIONS)[number];

function sectionOf(iso: string, now: Date): Section {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startYesterday = new Date(startToday.getTime() - 86400000);
  const mondayOffset = (now.getDay() + 6) % 7; // 0 = Monday
  const startThisWeek = new Date(startToday.getTime() - mondayOffset * 86400000);
  const startLastWeek = new Date(startThisWeek.getTime() - 7 * 86400000);
  const d = new Date(iso);
  if (d >= startToday) return "Today";
  if (d >= startYesterday) return "Yesterday";
  if (d >= startThisWeek) return "Earlier this week";
  if (d >= startLastWeek) return "Last week";
  return "Older";
}

function detailFor(row: LogRow): string | null {
  const meta = row.meta ?? {};
  if (typeof meta.title === "string") return meta.title;
  if (typeof meta.file_name === "string") return meta.file_name;
  if (typeof meta.count === "number") return `${meta.count} question${meta.count === 1 ? "" : "s"}`;
  return null;
}

const LAST_SEEN_KEY = "notifLastSeen";
const FILTERS: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "survey", label: "Surveys" },
  { key: "library", label: "Library" },
];

const STICKY_HEADER = "top-[calc(var(--topbar-h)+64px)]";

export default function Notifications() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [lastSeen, setLastSeen] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem(LAST_SEEN_KEY) ?? 0);
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity, entity_id, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const unreadCount = useMemo(
    () => (rows ?? []).filter((r) => new Date(r.created_at).getTime() > lastSeen).length,
    [rows, lastSeen],
  );

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      const m = metaFor(r.action);
      if (filter !== "all" && m.category !== filter) return false;
      if (needle) {
        const hay = `${m.verb} ${detailFor(r) ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, search, filter]);

  const sections = useMemo(() => {
    const now = new Date();
    const map = new Map<Section, LogRow[]>();
    for (const row of filtered) {
      const s = sectionOf(row.created_at, now);
      const list = map.get(s) ?? [];
      list.push(row);
      map.set(s, list);
    }
    return SECTIONS.map((s) => [s, map.get(s) ?? []] as const).filter(([, list]) => list.length > 0);
  }, [filtered]);

  function markAllRead() {
    const now = Date.now();
    localStorage.setItem(LAST_SEEN_KEY, String(now));
    setLastSeen(now);
  }

  return (
    <PageContainer className="lg:py-6">
      {/* Full workspace, capped and LEFT-aligned (enterprise, not a blog column). */}
      <div className="w-full max-w-[1440px]">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <div className="eyebrow text-primary">{t("navGroupSystem")}</div>
            <h1 className="mt-1.5 t-title">Activity</h1>
          </div>
          {unreadCount > 0 && (
            <span className="t-caption text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{unreadCount}</span> new since you last looked
            </span>
          )}
        </div>

        {/* Toolbar — search takes the majority of the row; filters to the right.
            Sticks under the app header so it's always reachable. */}
        <div className={cn(
          "sticky top-[var(--topbar-h)] z-20 -mx-1 mt-4 flex flex-col gap-3 bg-canvas/90 px-1 py-3 backdrop-blur-xl",
          "sm:flex-row sm:items-center",
        )}>
          <div className="relative w-full sm:max-w-[620px] sm:min-w-[min(100%,540px)] sm:flex-1">
            <Search className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tertiary" strokeWidth={1.7} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search activity…"
              aria-label="Search activity"
              className="h-11 pl-11"
            />
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            {/* Apple-style segmented control */}
            <div role="group" aria-label="Filter by type" className="flex shrink-0 gap-1 rounded-control bg-sunken p-1">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "relative h-8 rounded-[8px] px-3.5 t-caption font-medium transition-colors duration-fast",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]",
                    filter === f.key ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {filter === f.key && (
                    <motion.span
                      layoutId="notif-filter-active"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 -z-10 rounded-[8px] bg-card shadow-sm"
                    />
                  )}
                  {f.label}
                </button>
              ))}
            </div>
            {unreadCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllRead} className="shrink-0">
                <CheckCheck strokeWidth={1.7} />
                <span className="hidden sm:inline">Mark all read</span>
              </Button>
            )}
            <Button asChild variant="ghost" size="sm" className="shrink-0">
              <Link to="/app/audit">
                <ScrollText strokeWidth={1.6} />
                <span className="hidden lg:inline">{t("navAudit")}</span>
              </Link>
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-3">
                <Skeleton className="h-10 w-10 rounded-pill" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-64" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ) : !rows?.length ? (
          <EmptyTimeline />
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="t-section">No matching activity</p>
            <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
              Nothing matches “{search}”{filter !== "all" ? ` in ${filter}` : ""}. Try a broader search or clear the filter.
            </p>
          </div>
        ) : (
          <div role="feed" aria-label="Activity timeline" className="mt-2">
            {sections.map(([label, items]) => (
              <section key={label} aria-label={label}>
                <h2 className={cn("sticky z-10 -mx-1 bg-canvas/90 px-1 py-2 eyebrow backdrop-blur-sm", STICKY_HEADER)}>{label}</h2>
                <ol>
                  {items.map((row) => (
                    <ActivityRow key={row.id} row={row} unread={new Date(row.created_at).getTime() > lastSeen} />
                  ))}
                </ol>
              </section>
            ))}

            <p className="mt-8 border-t border-border/60 pt-5 t-caption text-muted-foreground">
              Showing recent activity ·{" "}
              <Link to="/app/audit" className="font-medium text-primary link-underline">
                view the full audit log
              </Link>
            </p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

/** One event, aligned to a fixed grid: icon · title/description · time/user. */
function ActivityRow({ row, unread }: { row: LogRow; unread: boolean }) {
  const m = metaFor(row.action);
  const detail = detailFor(row);
  const relatedSurveyId = row.entity === "survey" && row.entity_id ? row.entity_id : null;
  const surveyTitle = typeof row.meta?.title === "string" ? (row.meta.title as string) : null;

  const inner = (
    <>
      <span
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center rounded-pill transition-transform duration-fast group-hover:scale-105",
          TONE_CLASS[m.tone],
        )}
      >
        <m.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
      </span>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate t-body font-medium leading-snug">{m.verb}</span>
          {unread && <span aria-hidden className="h-2 w-2 shrink-0 rounded-pill bg-primary" />}
        </div>
        {detail && (
          <div className="mt-0.5 truncate t-caption text-muted-foreground">
            {relatedSurveyId && surveyTitle ? (
              <span className="text-foreground/80">{surveyTitle}</span>
            ) : (
              detail
            )}
          </div>
        )}
      </div>

      <div className="shrink-0 text-right">
        <time className="block whitespace-nowrap t-caption tabular-nums text-muted-foreground" dateTime={row.created_at} title={absoluteTime(row.created_at)}>
          {relativeTime(row.created_at)}
        </time>
        <span className="block text-[11px] text-tertiary">Administrator</span>
      </div>
    </>
  );

  // GPU-friendly hover lift (transform only) + click state when it links out.
  const base =
    "group grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-4 rounded-[12px] px-3 py-3 transition-[background-color,transform,box-shadow] duration-fast ease-out";

  if (relatedSurveyId) {
    return (
      <li className="animate-in-fade">
        <Link
          to={`/app/surveys/${relatedSurveyId}/edit`}
          className={cn(base, "hover:-translate-y-0.5 hover:bg-card hover:shadow-sm active:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]")}
        >
          {inner}
        </Link>
      </li>
    );
  }
  return (
    <li className={cn(base, "animate-in-fade hover:-translate-y-0.5 hover:bg-card hover:shadow-sm")}>{inner}</li>
  );
}

function EmptyTimeline() {
  return (
    <div className="mt-8 rounded-surface border border-dashed border-border p-12 text-center">
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
        <BellOff className="h-7 w-7 text-primary" strokeWidth={1.5} />
      </div>
      <h2 className="mt-6 t-section">Your activity timeline is ready</h2>
      <p className="mx-auto mt-2 max-w-md t-body text-muted-foreground">
        As you create surveys, publish them, import questions, or edit the library, each action lands here as a dated
        entry — so you always know what changed and when.
      </p>
      <Button asChild variant="outline" className="mt-6">
        <Link to="/app/surveys">
          <ClipboardList strokeWidth={1.6} />
          Create your first survey
        </Link>
      </Button>
    </div>
  );
}
