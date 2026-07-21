import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The one empty state in the console.
 *
 * Every page used to hand-roll its own — a 16x16 icon puck in a 24rem-tall
 * bordered box, or worse, a full table skeleton with nothing in it. A blank
 * surface is the moment a user most needs to be told what to do next, so this
 * always carries a title, a sentence of help, and at least one action.
 *
 * The illustrations are inline SVG drawn from design tokens rather than image
 * files: no network, no asset pipeline, and they follow the light/dark theme
 * for free.
 */

const STROKE = "hsl(var(--border-strong))";
const FILL = "hsl(var(--bg-sunken))";
const ACCENT = "hsl(var(--primary))";

/** A stack of collected records — Responses, Export. */
export function EmptyInboxArt() {
  return (
    <svg viewBox="0 0 160 116" fill="none" className="h-full w-auto" aria-hidden="true">
      <rect x="22" y="30" width="116" height="20" rx="7" fill={FILL} stroke={STROKE} strokeWidth="1.5" opacity="0.6" />
      <rect x="14" y="46" width="132" height="24" rx="8" fill={FILL} stroke={STROKE} strokeWidth="1.5" opacity="0.8" />
      <rect x="8" y="64" width="144" height="42" rx="10" fill="hsl(var(--card))" stroke={STROKE} strokeWidth="1.5" />
      <path d="M8 74h38a6 6 0 0 0 6 6h28a6 6 0 0 0 6-6h66" stroke={STROKE} strokeWidth="1.5" fill="none" />
      <circle cx="80" cy="22" r="11" fill="hsl(var(--primary-tint))" />
      <path d="M75.5 22.5l3 3 6-6.5" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Bars waiting for data — Analytics. */
export function EmptyChartArt() {
  return (
    <svg viewBox="0 0 160 116" fill="none" className="h-full w-auto" aria-hidden="true">
      <rect x="10" y="12" width="140" height="92" rx="12" fill="hsl(var(--card))" stroke={STROKE} strokeWidth="1.5" />
      <path d="M26 88h108" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" />
      <rect x="34" y="66" width="16" height="22" rx="4" fill={FILL} />
      <rect x="58" y="52" width="16" height="36" rx="4" fill={FILL} />
      <rect x="82" y="60" width="16" height="28" rx="4" fill="hsl(var(--primary-tint))" />
      <rect x="106" y="38" width="16" height="50" rx="4" fill={FILL} />
      <path d="M34 46c14 6 24-10 40-4s28-14 48-6" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.55" />
    </svg>
  );
}

/** Shelved instruments — Question Library. */
export function EmptyLibraryArt() {
  return (
    <svg viewBox="0 0 160 116" fill="none" className="h-full w-auto" aria-hidden="true">
      <rect x="24" y="18" width="50" height="80" rx="9" fill="hsl(var(--card))" stroke={STROKE} strokeWidth="1.5" />
      <rect x="86" y="30" width="50" height="68" rx="9" fill={FILL} stroke={STROKE} strokeWidth="1.5" />
      <path d="M36 38h26M36 50h26M36 62h16" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <path d="M98 48h26M98 60h26M98 72h16" stroke={STROKE} strokeWidth="2" strokeLinecap="round" opacity="0.7" />
      <circle cx="49" cy="82" r="9" fill="hsl(var(--primary-tint))" />
      <path d="M49 78v8M45 82h8" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A document with a chart in it — Reports. */
export function EmptyReportArt() {
  return (
    <svg viewBox="0 0 160 116" fill="none" className="h-full w-auto" aria-hidden="true">
      <rect x="34" y="8" width="92" height="100" rx="11" fill="hsl(var(--card))" stroke={STROKE} strokeWidth="1.5" />
      <path d="M48 26h48M48 38h64" stroke={STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <rect x="48" y="52" width="64" height="42" rx="7" fill={FILL} />
      <path d="M56 84l14-14 12 9 16-19" stroke={ACCENT} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="98" cy="60" r="3" fill={ACCENT} />
    </svg>
  );
}

/** A published survey reaching people — Surveys, QR. */
export function EmptySurveyArt() {
  return (
    <svg viewBox="0 0 160 116" fill="none" className="h-full w-auto" aria-hidden="true">
      <rect x="42" y="10" width="76" height="96" rx="12" fill="hsl(var(--card))" stroke={STROKE} strokeWidth="1.5" />
      <rect x="56" y="26" width="48" height="8" rx="4" fill={FILL} />
      <rect x="56" y="44" width="48" height="26" rx="7" fill={FILL} />
      <path d="M62 57h12M62 51h24M62 63h18" stroke={STROKE} strokeWidth="2" strokeLinecap="round" />
      <rect x="56" y="80" width="30" height="10" rx="5" fill="hsl(var(--primary-tint))" />
      <path d="M18 52c6-14 14-20 22-22M142 52c-6-14-14-20-22-22" stroke={STROKE} strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

export function EmptyState({
  illustration,
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  compact,
  className,
}: {
  illustration?: ReactNode;
  /** Fallback when no illustration fits — rendered in the app's accent puck. */
  icon?: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  /** For use inside a panel, where the full treatment would dominate. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center",
        compact ? "px-4 py-10" : "px-6 py-14 sm:py-16",
        className,
      )}
    >
      {illustration ? (
        <div className={cn("text-muted-foreground", compact ? "h-20" : "h-28 sm:h-32")}>{illustration}</div>
      ) : Icon ? (
        <span
          className={cn(
            "grid place-items-center rounded-pill bg-accent-tint text-primary",
            compact ? "h-12 w-12" : "h-16 w-16",
          )}
        >
          <Icon className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={1.5} />
        </span>
      ) : null}

      <h3 className={cn(compact ? "mt-4 t-card" : "mt-6 t-section")}>{title}</h3>
      {description && (
        <p className={cn("mx-auto max-w-sm text-muted-foreground", compact ? "mt-1.5 t-caption" : "mt-2 t-body")}>
          {description}
        </p>
      )}

      {(primaryAction || secondaryAction) && (
        <div className={cn("flex flex-wrap items-center justify-center gap-2", compact ? "mt-4" : "mt-7")}>
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
