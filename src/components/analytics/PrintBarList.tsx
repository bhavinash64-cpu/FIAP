import type { ValueCount } from "@/lib/analytics";

/**
 * Pure CSS/DOM bar list for the printable report. Deliberately not recharts —
 * an SVG ResizeObserver-driven chart can render at zero width when a
 * background tab is sent straight to the print dialog; plain divs always
 * have a real width by the time the browser rasterizes the page.
 */
export function PrintBarList({ counts }: { counts: ValueCount[] }) {
  return (
    <div className="space-y-1.5">
      {counts.map((c) => (
        <div key={c.value} className="flex items-center gap-2 text-[11px]">
          <div className="w-32 shrink-0 truncate text-right pr-1">{c.label}</div>
          <div className="flex-1 h-4 bg-[#eef0f3] rounded-sm overflow-hidden">
            <div className="h-full bg-[#122A54] rounded-sm" style={{ width: `${Math.max(2, c.pct * 100)}%` }} />
          </div>
          <div className="w-16 shrink-0 tabular-nums text-muted-foreground">{c.count} ({Math.round(c.pct * 100)}%)</div>
        </div>
      ))}
    </div>
  );
}
