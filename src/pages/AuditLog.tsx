import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";

type Row = { id: string; user_id: string | null; action: string; entity: string | null; entity_id: string | null; meta: Record<string, unknown> | null; created_at: string };

export default function AuditLog() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  const filtered = (rows ?? []).filter((r) => !q || r.action.includes(q) || (r.entity ?? "").includes(q));
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <p className="eyebrow text-primary">Governance</p>
      <h1 className="t-title mt-2">Audit log</h1>
      <p className="mt-2 t-caption text-muted-foreground">Immutable record of user actions. Latest 500 entries.</p>

      <Card className="mt-6 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" strokeWidth={1.5} />
          <Input placeholder="Filter by action or entity…" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 pl-9" />
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full t-caption">
            <thead className="text-left">
              <tr className="border-b border-border">
                <th className="eyebrow px-4 py-3 font-semibold">Time</th>
                <th className="eyebrow px-4 py-3 font-semibold">Action</th>
                <th className="eyebrow px-4 py-3 font-semibold">Entity</th>
                <th className="eyebrow px-4 py-3 font-semibold">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows === null ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-32" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-5 w-24 rounded-pill" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-16" /></td>
                    <td className="px-4 py-3"><Skeleton className="h-4 w-48" /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-16">
                    <div className="mx-auto grid max-w-xs place-items-center text-center">
                      <span className="grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
                        <ScrollText className="h-6 w-6 text-primary" strokeWidth={1.5} />
                      </span>
                      <p className="t-section mt-4">Nothing recorded yet</p>
                      <p className="mt-2 t-body text-muted-foreground">Every administrative action will appear here the moment it happens.</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="transition-colors duration-fast hover:bg-sunken">
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{r.action}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.entity ?? "—"}</td>
                  <td className="max-w-md truncate px-4 py-3 font-mono text-muted-foreground">{r.meta ? JSON.stringify(r.meta) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
