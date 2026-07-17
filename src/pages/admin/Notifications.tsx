import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Bell,
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
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
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

/**
 * How an audit action reads to a human, and how it looks. The audit log is the
 * raw record; this page is the same events told as a timeline an administrator
 * can skim — "Published a survey", not "survey.publish".
 */
const ACTION_META: Record<string, { icon: LucideIcon; verb: string; tone: string }> = {
  "survey.create": { icon: ClipboardList, verb: "Created a survey", tone: "text-primary" },
  "survey.publish": { icon: Send, verb: "Published a survey", tone: "text-success" },
  "survey.close": { icon: Lock, verb: "Closed a survey", tone: "text-warning" },
  "survey.reopen": { icon: RotateCcw, verb: "Reopened a survey", tone: "text-primary" },
  "survey.delete": { icon: Trash2, verb: "Deleted a survey", tone: "text-destructive" },
  "question.import.pdf": { icon: FileUp, verb: "Imported questions from a PDF", tone: "text-primary" },
  "question.import.voice": { icon: Upload, verb: "Added a question by voice", tone: "text-primary" },
  "question.import.library": { icon: Library, verb: "Imported questions from the library", tone: "text-primary" },
  "bank.instrument.create": { icon: Library, verb: "Added a library instrument", tone: "text-primary" },
  "bank.instrument.delete": { icon: Trash2, verb: "Removed a library instrument", tone: "text-destructive" },
  "bank.instrument.duplicate": { icon: Library, verb: "Duplicated a library instrument", tone: "text-primary" },
};

function metaFor(action: string) {
  if (ACTION_META[action]) return ACTION_META[action];
  // Anything not mapped still reads sensibly: "bank.item.revert" → "Bank item revert".
  const verb = action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  return { icon: Activity, verb, tone: "text-muted-foreground" };
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function dayBucket(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today.getTime() - 86400000);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

/** A survey's title travels in the audit meta on create/publish. */
function detailFor(row: LogRow): string | null {
  const meta = row.meta ?? {};
  if (typeof meta.title === "string") return meta.title;
  if (typeof meta.file_name === "string") return meta.file_name;
  if (typeof meta.count === "number") return `${meta.count} question${meta.count === 1 ? "" : "s"}`;
  return null;
}

export default function Notifications() {
  const t = useT();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action, entity, entity_id, meta, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as LogRow[];
    },
  });

  const groups = useMemo(() => {
    const map = new Map<string, LogRow[]>();
    for (const row of rows ?? []) {
      const key = dayBucket(row.created_at);
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  const summary = useMemo(() => {
    const list = rows ?? [];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = list.filter((r) => new Date(r.created_at) >= startOfToday).length;
    const byVerb = new Map<string, number>();
    for (const r of list) {
      const verb = metaFor(r.action).verb;
      byVerb.set(verb, (byVerb.get(verb) ?? 0) + 1);
    }
    const top = Array.from(byVerb.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
    return { total: list.length, today, top };
  }, [rows]);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupGovernance")}
        title={t("navNotifications")}
        subtitle="Recent activity across the platform, newest first."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/app/audit">
              <Activity strokeWidth={1.6} />
              {t("navAudit")}
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <div className="mt-8 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 rounded-surface border border-border/70 p-4">
              <Skeleton className="h-10 w-10 rounded-control" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : !rows?.length ? (
        <div className="mt-8 rounded-surface border border-dashed border-border p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <BellOff className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">You're all caught up</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
            Activity — new surveys, publishing, imports — will appear here as it happens.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
          <div className="space-y-8">
            {groups.map(([label, items]) => (
              <section key={label}>
                <h2 className="mb-2 px-1 eyebrow">{label}</h2>
                <ul className="overflow-hidden rounded-surface border border-border/70 bg-card">
                  {items.map((row, i) => {
                    const meta = metaFor(row.action);
                    const detail = detailFor(row);
                    return (
                      <li
                        key={row.id}
                        className={cn("flex items-start gap-3.5 p-4", i > 0 && "border-t border-border/60")}
                      >
                        <span className={cn("mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-control bg-muted", meta.tone)}>
                          <meta.icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="t-body font-medium leading-snug">{meta.verb}</div>
                          {detail && <div className="mt-0.5 truncate t-caption text-muted-foreground">{detail}</div>}
                        </div>
                        <time className="shrink-0 whitespace-nowrap t-caption text-muted-foreground" dateTime={row.created_at}>
                          {relativeTime(row.created_at)}
                        </time>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <aside className="lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-surface border border-border/70 bg-card p-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="t-title tabular-nums leading-none">{summary.total}</div>
                  <div className="mt-1.5 t-caption text-muted-foreground">Recent events</div>
                </div>
                <div>
                  <div className="t-title tabular-nums leading-none text-primary">{summary.today}</div>
                  <div className="mt-1.5 t-caption text-muted-foreground">Today</div>
                </div>
              </div>
              <div className="mt-5 border-t border-border/60 pt-4">
                <div className="mb-2 eyebrow">By type</div>
                <ul className="space-y-1.5">
                  {summary.top.map(([verb, count]) => (
                    <li key={verb} className="flex items-center justify-between gap-3 t-caption">
                      <span className="min-w-0 truncate text-muted-foreground">{verb}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageContainer>
  );
}
