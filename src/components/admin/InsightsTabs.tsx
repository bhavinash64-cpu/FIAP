import { Link, useLocation } from "react-router-dom";
import { BarChart3, FileText } from "lucide-react";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
   Analytics and Reports are ONE destination with two views, not two peers in
   the sidebar.

   They were never duplicates — Analytics is the doorway into a single survey's
   per-question breakdowns, Reports is the periodised analysis across the whole
   programme — but presenting them as sibling nav entries invited exactly that
   reading, and an officer looking for "the numbers" had to guess which of two
   identically-plausible destinations held them. One entry, two tabs: the guess
   disappears and the distinction becomes visible instead of implied.
*/
const TABS = [
  { to: "/app/analytics", labelKey: "navAnalytics", icon: BarChart3 },
  { to: "/app/reports", labelKey: "navReports", icon: FileText },
] as const;

export function InsightsTabs() {
  const { pathname } = useLocation();
  const t = useT();

  return (
    <div className="mt-6 inline-flex rounded-control border border-border bg-card p-1" role="tablist">
      {TABS.map((tab) => {
        const active = pathname === tab.to;
        return (
          <Link
            key={tab.to}
            to={tab.to}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-control px-3.5 py-2 t-caption font-medium transition-colors duration-base",
              active
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <tab.icon className="h-4 w-4" strokeWidth={1.8} />
            {t(tab.labelKey)}
          </Link>
        );
      })}
    </div>
  );
}
