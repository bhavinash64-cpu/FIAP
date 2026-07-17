import { cn } from "@/lib/utils";

/**
 * The neutral alternative to a face: a ramp of bars showing where an option
 * sits on its scale, with no opinion about whether that position is good.
 * Used for frequency, truth and description scales — see lib/answerVisuals.
 *
 * Decorative only. The option's text label is the accessible name, so this is
 * hidden from assistive tech rather than read out as "bar bar bar".
 */
export function ScaleMeter({ level, total, active }: { level: number; total: number; active: boolean }) {
  return (
    <span aria-hidden className="flex h-7 items-end gap-[3px]">
      {Array.from({ length: total }, (_, i) => {
        const filled = i < level;
        // Ramp from 40% to 100% of the track height so the shape reads as
        // "more" even before the fill colour is noticed.
        const height = 40 + (i / Math.max(1, total - 1)) * 60;
        return (
          <span
            key={i}
            style={{ height: `${height}%` }}
            className={cn(
              "w-[5px] rounded-pill transition-colors duration-base",
              filled ? (active ? "bg-primary" : "bg-foreground/45") : "bg-foreground/12",
            )}
          />
        );
      })}
    </span>
  );
}
