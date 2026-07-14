import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Row = { id: string; user_id: string | null; action: string; entity: string | null; entity_id: string | null; meta: Record<string, unknown> | null; created_at: string };

export default function AuditLog() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(500).then(({ data }) => setRows((data ?? []) as Row[]));
  }, []);
  const filtered = rows.filter((r) => !q || r.action.includes(q) || (r.entity ?? "").includes(q));
  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">Immutable record of user actions. Latest 500 entries.</p>

      <Card className="mt-6 rounded-2xl border-border/70 p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Filter by action or entity…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9 h-11 rounded-xl" />
        </div>
      </Card>

      <Card className="mt-4 rounded-2xl border-border/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Meta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="py-16 text-center text-muted-foreground">No entries.</td></tr>
              ) : filtered.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge variant="outline">{r.action}</Badge></td>
                  <td className="px-4 py-3 text-muted-foreground">{r.entity ?? "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground max-w-md truncate">{r.meta ? JSON.stringify(r.meta) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
