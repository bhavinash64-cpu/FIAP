import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { useT } from "@/lib/i18n";

type Row = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
};

const PAGE_SIZE = 25;

/** Humanised action label + badge tone, mirroring the Notification Center. */
function humanize(action: string): { label: string; tone: "default" | "success" | "danger" | "secondary" | "outline" } {
  const map: Record<string, { label: string; tone: "default" | "success" | "danger" | "secondary" | "outline" }> = {
    "survey.create": { label: "Survey created", tone: "default" },
    "survey.publish": { label: "Survey published", tone: "success" },
    "survey.close": { label: "Survey closed", tone: "secondary" },
    "survey.reopen": { label: "Survey reopened", tone: "default" },
    "survey.delete": { label: "Survey deleted", tone: "danger" },
    "question.import.pdf": { label: "Imported from PDF", tone: "default" },
    "question.import.voice": { label: "Question by voice", tone: "default" },
    "question.import.library": { label: "Imported from library", tone: "default" },
    "bank.instrument.create": { label: "Library instrument added", tone: "default" },
    "bank.instrument.delete": { label: "Library instrument removed", tone: "danger" },
    "bank.instrument.duplicate": { label: "Instrument duplicated", tone: "default" },
    "bank.item.revert": { label: "Question reverted", tone: "secondary" },
  };
  return map[action] ?? { label: action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase()), tone: "outline" };
}

function formatMeta(meta: Record<string, unknown> | null): string {
  if (!meta || !Object.keys(meta).length) return "—";
  if (typeof meta.title === "string") return meta.title;
  if (typeof meta.file_name === "string") return meta.file_name;
  return Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default function AuditLog() {
  const t = useT();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows ?? [];
    return (rows ?? []).filter(
      (r) =>
        r.action.toLowerCase().includes(needle) ||
        (r.entity ?? "").toLowerCase().includes(needle) ||
        humanize(r.action).label.toLowerCase().includes(needle),
    );
  }, [rows, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupGovernance")}
        title={t("navAudit")}
        subtitle="An immutable record of every administrative action."
      />

      <div className="mt-6 rounded-surface border border-border/70 bg-card p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" strokeWidth={1.5} />
          <Input
            placeholder="Filter by action or entity…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            className="h-11 pl-9"
          />
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-surface border border-border/70 bg-card">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="eyebrow px-5 py-3 font-semibold">Time</th>
                <th className="eyebrow px-5 py-3 font-semibold">Action</th>
                <th className="eyebrow px-5 py-3 font-semibold">Entity</th>
                <th className="eyebrow px-5 py-3 font-semibold">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-36" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-5 w-28 rounded-pill" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-5 py-3.5"><Skeleton className="h-4 w-48" /></td>
                  </tr>
                ))
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16">
                    <div className="mx-auto grid max-w-xs place-items-center text-center">
                      <span className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
                        <ScrollText className="h-6 w-6 text-primary" strokeWidth={1.5} />
                      </span>
                      <p className="mt-4 t-section">{q ? "No matching entries" : "Nothing recorded yet"}</p>
                      <p className="mt-2 t-body text-muted-foreground">
                        {q ? "Try a different search term." : "Every administrative action will appear here the moment it happens."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => {
                  const h = humanize(r.action);
                  return (
                    <tr key={r.id} className="transition-colors duration-fast hover:bg-sunken">
                      <td className="whitespace-nowrap px-5 py-3.5 t-caption text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge variant={h.tone}>{h.label}</Badge>
                      </td>
                      <td className="px-5 py-3.5 t-caption text-muted-foreground">{r.entity ?? "—"}</td>
                      <td className="max-w-md truncate px-5 py-3.5 t-caption text-muted-foreground" title={formatMeta(r.meta)}>
                        {formatMeta(r.meta)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3">
            <span className="t-caption text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground tabular-nums">
                {safePage * PAGE_SIZE + 1}–{Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)}
              </span>{" "}
              of <span className="font-semibold text-foreground tabular-nums">{filtered.length}</span>
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
              >
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
    </PageContainer>
  );
}
