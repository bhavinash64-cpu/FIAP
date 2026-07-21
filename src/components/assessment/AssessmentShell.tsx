import { useEffect, useRef, type ReactNode } from "react";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { SupportButton } from "@/components/assessment/SupportButton";
import { useAssessmentChrome } from "@/components/assessment/AssessmentChrome";
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
  const { headerAction, identityLine } = useAssessmentChrome();
  const mainRef = useRef<HTMLElement>(null);

  // Every stage is a distinct component, so it mounts fresh — move focus to its
  // heading on mount so a keyboard/screen-reader user lands on the new content
  // instead of a stale control from the previous screen.
  useEffect(() => {
    const heading = mainRef.current?.querySelector<HTMLElement>("h1, h2");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center gap-3 px-5 sm:px-6">
          <Logo size={36} />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate t-caption font-semibold text-foreground">{t("appShort")}</div>
            <div className="truncate text-[11px] font-medium text-muted-foreground">
              {identityLine ?? t("orgLine")}
            </div>
          </div>
          {headerAction}
          <LangToggle size="sm" />
        </div>
        {progress}
      </header>

      <main
        ref={mainRef}
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 sm:px-6",
          center ? "justify-center py-10" : "py-8",
        )}
      >
        {children}
      </main>

      {footer}

      {/* Raised clear of the action bar on stages that have one. */}
      <SupportButton raised={!!footer} />
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
