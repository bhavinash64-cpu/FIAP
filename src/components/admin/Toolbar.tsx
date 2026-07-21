import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The filter row.
 *
 * The rule it encodes: the search field GROWS and the controls DON'T. Every
 * filter bar in the app previously used an even grid, so on a wide monitor a
 * two-word "All surveys" select stretched across a quarter of the screen while
 * the search box it sat beside got no more room. Controls are capped; the slack
 * goes to the input that can use it.
 */
export function Toolbar({
  search,
  children,
  trailing,
  sticky,
  className,
}: {
  search?: ReactNode;
  children?: ReactNode;
  trailing?: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-surface border border-border/70 bg-card p-2.5 sm:flex-row sm:items-center",
        sticky && "sticky top-[calc(var(--topbar-h)+0.5rem)] z-20 shadow-sm backdrop-blur-xl",
        className,
      )}
    >
      {search && <div className="min-w-0 flex-1">{search}</div>}
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
      {trailing && <div className="flex shrink-0 items-center gap-2 sm:ml-auto">{trailing}</div>}
    </div>
  );
}

/** Search input with a leading glyph and a clear affordance. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** Accessible name — the visible placeholder is not one. */
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tertiary" strokeWidth={1.5} />
      <Input
        type="search"
        value={value}
        aria-label={label}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-pill text-tertiary transition-colors hover:bg-sunken hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
}
