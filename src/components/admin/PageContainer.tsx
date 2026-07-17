import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard admin page frame: full-bleed inside the content column, with
 * only a comfortable gutter — no centred max-width that leaves the screen half
 * empty. Every admin page uses this so widths never drift page to page.
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8", className)}>{children}</div>;
}

/**
 * The page heading block, with an optional actions slot that sits to the right
 * on wide screens and wraps beneath on narrow ones.
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="mt-2 t-title text-balance">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl t-body text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
