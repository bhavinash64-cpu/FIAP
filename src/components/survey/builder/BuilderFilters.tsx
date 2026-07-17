import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QuestionTypeIcon } from "@/components/survey/QuestionTypeIcon";
import { useBuilderStore, selectFiltering } from "@/stores/builderStore";
import { QUESTION_KINDS, type QuestionKind } from "@/lib/surveys";

/**
 * Search + filter controls. Isolated from the list so typing a query re-renders
 * this bar and the list membership, never the individual question rows.
 */
export function BuilderFilters({ visibleCount, total }: { visibleCount: number; total: number }) {
  const search = useBuilderStore((s) => s.search);
  const setSearch = useBuilderStore((s) => s.setSearch);
  const kindFilter = useBuilderStore((s) => s.kindFilter);
  const setKindFilter = useBuilderStore((s) => s.setKindFilter);
  const requiredFilter = useBuilderStore((s) => s.requiredFilter);
  const setRequiredFilter = useBuilderStore((s) => s.setRequiredFilter);
  const filtering = useBuilderStore(selectFiltering);

  function clear() {
    setSearch("");
    setKindFilter("all");
    setRequiredFilter("all");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search questions…"
          aria-label="Search questions"
          className="h-8 w-full rounded-control border border-border/70 bg-card pl-8 pr-7 t-caption outline-none focus:border-primary/50"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <Select value={kindFilter} onValueChange={(v) => setKindFilter(v as QuestionKind | "all")}>
        <SelectTrigger className="h-8 w-auto gap-1.5 rounded-control t-caption" aria-label="Filter by type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All types</SelectItem>
          {QUESTION_KINDS.map((k) => (
            <SelectItem key={k.value} value={k.value}>
              <span className="flex items-center gap-2">
                <QuestionTypeIcon kind={k.value} className="h-3.5 w-3.5" />
                {k.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={requiredFilter} onValueChange={(v) => setRequiredFilter(v as "all" | "required" | "optional")}>
        <SelectTrigger className="h-8 w-auto gap-1.5 rounded-control t-caption" aria-label="Filter by required">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Required & optional</SelectItem>
          <SelectItem value="required">Required only</SelectItem>
          <SelectItem value="optional">Optional only</SelectItem>
        </SelectContent>
      </Select>

      {filtering && (
        <>
          <span className="t-caption text-muted-foreground tabular-nums">
            {visibleCount} of {total}
          </span>
          <Button size="sm" variant="ghost" className="h-8 t-caption" onClick={clear}>
            Clear
          </Button>
        </>
      )}
    </div>
  );
}
