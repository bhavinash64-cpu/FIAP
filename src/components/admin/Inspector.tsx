import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The right-side record inspector.
 *
 * Opening a record used to mean either a route change (which threw away the
 * list, the filters and the scroll position) or a centred modal (which blacks
 * out the workspace behind it). This slides in from the edge over a soft scrim,
 * so the table stays legible and the administrator never loses their place —
 * the interaction Linear, Airtable and Stripe all settled on.
 *
 * It is Radix Dialog underneath, not the shadcn Sheet: Sheet's `bg-black/80`
 * overlay and `sm:max-w-sm` width are both wrong for reading an answer sheet.
 *
 * On phones the same component becomes a bottom sheet, because a 640px drawer
 * on a 360px screen is just a modal with extra steps.
 */

export function Inspector({
  open,
  onOpenChange,
  eyebrow,
  title,
  subtitle,
  headerMeta,
  footer,
  onPrev,
  onNext,
  positionLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Badges and facts under the title — kept in the sticky header. */
  headerMeta?: ReactNode;
  /** Sticky action bar pinned to the bottom edge. */
  footer?: ReactNode;
  onPrev?: () => void;
  onNext?: () => void;
  /** e.g. "3 of 20" — shown between the prev/next chevrons. */
  positionLabel?: string;
  children: ReactNode;
}) {
  // Walking records with the keyboard is the difference between a viewer and a
  // tool. Bound on the document rather than the panel so the shortcut works
  // wherever focus happens to have landed inside the drawer.
  useEffect(() => {
    if (!open || (!onPrev && !onNext)) return;
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      if ((e.key === "ArrowUp" || e.key === "k") && onPrev) {
        e.preventDefault();
        onPrev();
      } else if ((e.key === "ArrowDown" || e.key === "j") && onNext) {
        e.preventDefault();
        onNext();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onPrev, onNext]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-foreground/20 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed z-50 flex flex-col bg-card shadow-float outline-none",
            // Phone: a bottom sheet that keeps a strip of the list visible.
            "inset-x-0 bottom-0 top-14 rounded-t-surface border-t border-border",
            // Desktop: a full-height right rail.
            "md:inset-y-0 md:left-auto md:right-0 md:top-0 md:w-full md:max-w-xl md:rounded-none md:border-l md:border-t-0 lg:max-w-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "md:data-[state=open]:slide-in-from-bottom-0 md:data-[state=closed]:slide-out-to-bottom-0",
            "md:data-[state=open]:slide-in-from-right md:data-[state=closed]:slide-out-to-right",
            "duration-300 ease-out motion-reduce:animate-none",
          )}
        >
          <header className="shrink-0 border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                {eyebrow && <div className="eyebrow text-primary">{eyebrow}</div>}
                <DialogPrimitive.Title className="mt-0.5 truncate t-section">{title}</DialogPrimitive.Title>
                {subtitle && (
                  <DialogPrimitive.Description className="mt-1 truncate t-caption text-muted-foreground">
                    {subtitle}
                  </DialogPrimitive.Description>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {(onPrev || onNext) && (
                  <div className="mr-1 hidden items-center gap-0.5 sm:flex">
                    <button
                      type="button"
                      onClick={onPrev}
                      disabled={!onPrev}
                      aria-label="Previous record"
                      className="grid h-8 w-8 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <button
                      type="button"
                      onClick={onNext}
                      disabled={!onNext}
                      aria-label="Next record"
                      className="grid h-8 w-8 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-35 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    {positionLabel && (
                      <span className="px-1 t-caption tabular-nums text-tertiary">{positionLabel}</span>
                    )}
                  </div>
                )}
                <DialogPrimitive.Close
                  aria-label="Close"
                  className="grid h-9 w-9 place-items-center rounded-control text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="h-4 w-4" strokeWidth={1.9} />
                </DialogPrimitive.Close>
              </div>
            </div>

            {headerMeta && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">{headerMeta}</div>}
          </header>

          <div className="thin-scrollbar min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>

          {footer && (
            <footer className="shrink-0 border-t border-border bg-card px-5 py-3 sm:px-6">{footer}</footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** A labelled block inside the inspector body. */
export function InspectorSection({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("py-1", className)}>
      <div className="mb-2 flex items-center gap-2">
        <h4 className="eyebrow">{title}</h4>
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
  );
}
