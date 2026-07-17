import type { ReactNode } from "react";
import { Shield } from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The frame every stage of the guided assessment sits in: a quiet identity bar,
 * an optional progress strip, one centred column, and an optional action bar.
 *
 * The column is capped at 40rem and vertically centred. That is the whole point
 * of the redesign — a stage holds one thing, and the respondent never scrolls
 * looking for what to do next.
 */
export function AssessmentShell({
  children,
  progress,
  footer,
  /** Let a stage own the full height (used by the question screen). */
  center = true,
}: {
  children: ReactNode;
  progress?: ReactNode;
  footer?: ReactNode;
  center?: boolean;
}) {
  const t = useT();

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-5 sm:px-6">
          <div className="brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-control">
            <Shield className="h-[18px] w-[18px] text-primary-foreground" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate t-caption font-semibold text-foreground">{t("appShort")}</div>
            <div className="truncate text-[11px] font-medium text-muted-foreground">{t("govOf")}</div>
          </div>
          <LangToggle size="sm" />
        </div>
        {progress}
      </header>

      <main
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 sm:px-6",
          center ? "justify-center py-10" : "py-8",
        )}
      >
        {children}
      </main>

      {footer}
    </div>
  );
}

/**
 * Sticky action bar. It stays in the viewport so Previous/Next are always
 * reachable without scrolling, including on a long BDI item.
 */
export function AssessmentFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="sticky bottom-0 z-30 border-t border-border/60 bg-canvas/95 backdrop-blur-xl">
      <div className="bottom-nav-safe mx-auto w-full max-w-2xl px-5 py-3 sm:px-6">{children}</div>
    </footer>
  );
}
