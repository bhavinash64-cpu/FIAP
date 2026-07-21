import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronLeft, ChevronRight, Loader2, MessageSquareText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/survey/EmptyState";
import { getTextAnswers } from "@/lib/analytics";

const PAGE_SIZE = 10;

export function TextAnswerList({ questionId }: { questionId: string }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Keyed query: cancellation + error handling are automatic, and a slow older
  // page/search can never overwrite the current one.
  const { data, isError } = useQuery({
    queryKey: ["text-answers", questionId, debouncedSearch, page],
    queryFn: () => getTextAnswers(questionId, { search: debouncedSearch, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
  });
  const rows = data?.rows;
  const total = data?.total ?? 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search responses…" className="pl-8 h-9 rounded-lg text-sm" />
      </div>

      {isError ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Couldn't load responses. Reload to try again.</div>
      ) : rows === undefined ? (
        <div className="py-8 grid place-items-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={MessageSquareText} title="No responses yet" body={debouncedSearch ? "No answers match your search." : undefined} />
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div key={r.id} className="rounded-surface border border-border/50 bg-muted/40 p-3 t-body">
              <div className="whitespace-pre-wrap leading-relaxed">{r.value}</div>
              {r.submittedAt && <div className="mt-1.5 t-caption text-muted-foreground">{new Date(r.submittedAt).toLocaleString()}</div>}
            </div>
          ))}
        </div>
      )}

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between t-caption text-muted-foreground pt-1">
          <span>{page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}</span>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
