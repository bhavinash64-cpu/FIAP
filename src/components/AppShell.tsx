import { useCallback, useState, type ReactNode, type CSSProperties } from "react";
import { NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutGrid,
  ClipboardList,
  Library,
  LayoutTemplate,
  QrCode,
  Inbox,
  BarChart3,
  FileText,
  Download,
  Bell,
  ScrollText,
  Settings,
  HelpCircle,
  LogOut,
  PanelLeft,
  ChevronDown,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LangToggle } from "@/components/LangToggle";
import { useT, type DictKey } from "@/lib/i18n";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

type NavT = { to: string; labelKey: DictKey; icon: LucideIcon; end?: boolean };
type NavGroup = { labelKey: DictKey; items: NavT[] };

/**
 * Navigation, grouped by what an administrator is trying to do rather than by
 * one flat list. The Question Library sits under Surveys (it is the material
 * surveys are built from); distribution earns its own destination now that a
 * QR/link is the entire public entry path.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: "navGroupWorkspace",
    items: [{ to: "/app", labelKey: "navOverview", icon: LayoutGrid, end: true }],
  },
  {
    labelKey: "navGroupSurveys",
    items: [
      { to: "/app/surveys", labelKey: "navSurveys", icon: ClipboardList },
      { to: "/app/question-bank", labelKey: "navQuestionBank", icon: Library },
      { to: "/app/templates", labelKey: "navTemplates", icon: LayoutTemplate },
      { to: "/app/qr", labelKey: "navQr", icon: QrCode },
    ],
  },
  {
    labelKey: "navGroupInsights",
    items: [
      { to: "/app/responses", labelKey: "navResponses", icon: Inbox },
      { to: "/app/analytics", labelKey: "navAnalytics", icon: BarChart3 },
      { to: "/app/reports", labelKey: "navReports", icon: FileText },
      { to: "/app/export", labelKey: "navExport", icon: Download },
    ],
  },
  {
    labelKey: "navGroupGovernance",
    items: [
      { to: "/app/notifications", labelKey: "navNotifications", icon: Bell },
      { to: "/app/audit", labelKey: "navAudit", icon: ScrollText },
      { to: "/app/settings", labelKey: "navSettings", icon: Settings },
      { to: "/app/help", labelKey: "navHelp", icon: HelpCircle },
    ],
  },
];

const ALL_NAV: NavT[] = NAV_GROUPS.flatMap((g) => g.items);

/**
 * The bottom bar carries the four destinations that get daily use; everything
 * else sits one tap away in the More sheet. Four tabs + More across a 320px
 * screen keeps each cell above the touch minimum.
 */
const BOTTOM_TAB_ROUTES = ["/app", "/app/surveys", "/app/responses", "/app/analytics"];
const BOTTOM_TABS = ALL_NAV.filter((n) => BOTTOM_TAB_ROUTES.includes(n.to));
const MORE_GROUPS: NavGroup[] = NAV_GROUPS.map((g) => ({
  ...g,
  items: g.items.filter((n) => !BOTTOM_TAB_ROUTES.includes(n.to)),
})).filter((g) => g.items.length);
const MORE_TABS = MORE_GROUPS.flatMap((g) => g.items);

const COLLAPSED = 64;
const EXPANDED = 248;

const ROUTE_PREFETCH: Partial<Record<string, () => Promise<unknown>>> = {
  "/app": () => import("@/pages/admin/Overview"),
  "/app/surveys": () => import("@/pages/admin/SurveyList"),
  "/app/question-bank": () => import("@/pages/admin/QuestionBank"),
  "/app/templates": () => import("@/pages/admin/Templates"),
  "/app/qr": () => import("@/pages/admin/QrManager"),
  "/app/responses": () => import("@/pages/admin/Responses"),
  "/app/analytics": () => import("@/pages/admin/AnalyticsHome"),
  "/app/reports": () => import("@/pages/admin/Reports"),
  "/app/export": () => import("@/pages/admin/ExportCenter"),
  "/app/notifications": () => import("@/pages/admin/Notifications"),
  "/app/audit": () => import("@/pages/AuditLog"),
  "/app/settings": () => import("@/pages/admin/SettingsPage"),
  "/app/help": () => import("@/pages/admin/HelpAbout"),
};

const prefetchedRoutes = new Set<string>();

function prefetchRoute(to: string) {
  if (prefetchedRoutes.has(to)) return;
  prefetchedRoutes.add(to);
  void ROUTE_PREFETCH[to]?.().catch(() => prefetchedRoutes.delete(to));
}

/** Touch has no hover, so the phone equivalent of prefetch-on-hover is
 *  prefetch-on-touch-start: it buys the ~80ms between finger-down and the tap
 *  registering, which is often the whole chunk fetch on a warm connection. */
const prefetchOnPress = (to: string) => ({
  onMouseEnter: () => prefetchRoute(to),
  onFocus: () => prefetchRoute(to),
  onTouchStart: () => prefetchRoute(to),
});

function NavRow({ item, label, showText, onNavigate }: { item: NavT; label: string; showText: boolean; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      {...prefetchOnPress(item.to)}
      className={({ isActive }) =>
        cn(
          "group relative flex h-11 items-center gap-3 rounded-control px-[11px] transition-colors duration-base ease-out active:scale-[0.98] lg:h-10",
          isActive ? "bg-accent font-semibold text-primary" : "font-medium text-muted-foreground hover:bg-muted hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className="grid w-5 shrink-0 place-items-center">
            <item.icon
              className={cn("h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110", isActive ? "text-primary" : "text-current")}
              strokeWidth={isActive ? 2.1 : 1.8}
            />
          </span>
          {showText && <span className="whitespace-nowrap t-caption">{label}</span>}
          {!showText && (
            <span className="pointer-events-none absolute left-[calc(100%+0.6rem)] z-50 hidden -translate-x-1 whitespace-nowrap rounded-control bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-float transition-all duration-base ease-out group-hover:translate-x-0 group-hover:opacity-100 lg:block">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function SidebarBody({ expanded }: { expanded: boolean }) {
  const t = useT();
  return (
    <>
      <div className="flex items-center gap-3 px-[7px] pb-4">
        <motion.div whileHover={{ rotate: -8, scale: 1.06 }} transition={{ type: "spring", stiffness: 300, damping: 14 }} className="brand-gradient grid h-9 w-9 shrink-0 place-items-center rounded-control t-title font-bold text-primary-foreground shadow-sm">
          J
        </motion.div>
        {expanded && (
          <div className="min-w-0 leading-tight">
            <div className="truncate t-card font-semibold tracking-tight">Jeevana Insight</div>
            <div className="truncate t-caption text-muted-foreground">AP Police · Research</div>
          </div>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto thin-scrollbar">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.labelKey} className={cn(gi > 0 && "mt-3")}>
            {expanded ? (
              <div className="px-[11px] pb-1 pt-1 eyebrow">{t(group.labelKey)}</div>
            ) : (
              gi > 0 && <div className="mx-2 my-2 h-px bg-border" />
            )}
            {group.items.map((item) => (
              <NavRow key={item.to} item={item} label={t(item.labelKey)} showText={expanded} />
            ))}
          </div>
        ))}
      </nav>
    </>
  );
}

function ProfileMenu({ email, onSignOut }: { email?: string; onSignOut: () => void }) {
  const t = useT();
  const initial = (email?.[0] ?? "S").toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="group flex h-11 items-center gap-2 rounded-nav border border-border/70 py-1 pl-1 pr-1.5 transition-colors hover:bg-muted focus:outline-none sm:pr-2 lg:h-auto">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-primary/10 t-caption font-semibold text-primary lg:h-8 lg:w-8">{initial}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[130px] truncate t-caption font-medium">{email ?? "Super admin"}</span>
          <span className="eyebrow block">Administrator</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 sm:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer gap-2 rounded-control">
          <Link to="/app/settings"><Settings className="h-4 w-4" /> {t("navSettings")}</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onSignOut} className="cursor-pointer gap-2 rounded-control text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> {t("signOut")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** One cell of the mobile bottom bar. The entire cell is the target: at 320px
 *  that is 64x64, clear of the 48px minimum with room to spare. */
function BottomTab({ item, label }: { item: NavT; label: string }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      {...prefetchOnPress(item.to)}
      className={({ isActive }) =>
        cn(
          "relative flex h-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-fast",
          isActive ? "text-primary" : "text-muted-foreground active:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="bottom-tab-indicator"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="absolute inset-x-2.5 top-0 h-[2px] rounded-pill bg-primary"
            />
          )}
          <item.icon className="h-[22px] w-[22px] shrink-0" strokeWidth={isActive ? 2.2 : 1.7} />
          <span className="w-full truncate text-center text-[11px] font-medium leading-none">{label}</span>
        </>
      )}
    </NavLink>
  );
}

function BottomNav({ onSignOut }: { onSignOut: () => void }) {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const moreActive = MORE_TABS.some((n) => location.pathname.startsWith(n.to) && n.to !== "/app");

  return (
    <>
      <nav
        aria-label="Primary"
        className="bottom-nav-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-xl md:hidden"
      >
        <div className="grid h-[var(--bottom-nav-h)] grid-cols-5">
          {BOTTOM_TABS.map((item) => (
            <BottomTab key={item.to} item={item} label={t(item.labelKey)} />
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            onTouchStart={() => MORE_TABS.forEach((n) => prefetchRoute(n.to))}
            aria-expanded={moreOpen}
            aria-haspopup="dialog"
            className={cn(
              "relative flex h-full min-w-0 flex-col items-center justify-center gap-1 px-0.5 transition-colors duration-fast",
              moreActive ? "text-primary" : "text-muted-foreground active:text-foreground",
            )}
          >
            {moreActive && <span className="absolute inset-x-2.5 top-0 h-[2px] rounded-pill bg-primary" />}
            <MoreHorizontal className="h-[22px] w-[22px] shrink-0" strokeWidth={moreActive ? 2.2 : 1.7} />
            <span className="w-full truncate text-center text-[11px] font-medium leading-none">{t("navMore")}</span>
          </button>
        </div>
      </nav>

      <Drawer open={moreOpen} onOpenChange={setMoreOpen}>
        <DrawerContent className="md:hidden">
          <DrawerTitle className="px-5 pb-2 t-section">{t("navMoreTitle")}</DrawerTitle>
          <div className="max-h-[65vh] overflow-y-auto px-3 pb-2 thin-scrollbar">
            {MORE_GROUPS.map((group) => (
              <div key={group.labelKey} className="mb-1">
                <div className="px-3 pb-1 pt-2 eyebrow">{t(group.labelKey)}</div>
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMoreOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        "flex h-14 items-center gap-3 rounded-control px-3 transition-colors",
                        isActive ? "bg-accent font-semibold text-primary" : "font-medium text-foreground active:bg-muted",
                      )
                    }
                  >
                    <item.icon className="h-5 w-5 shrink-0" strokeWidth={1.8} />
                    <span className="t-body">{t(item.labelKey)}</span>
                  </NavLink>
                ))}
              </div>
            ))}
            <button
              type="button"
              onClick={() => { setMoreOpen(false); onSignOut(); }}
              className="flex h-14 w-full items-center gap-3 rounded-control px-3 font-medium text-destructive transition-colors active:bg-destructive/10"
            >
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={1.8} />
              <span className="t-body">{t("signOut")}</span>
            </button>
          </div>
          <div className="bottom-nav-safe pb-2" />
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("navExpanded");
    if (saved !== null) return saved === "1";
    return window.innerWidth >= 1024;
  });

  function toggle() {
    setExpanded((v) => {
      const next = !v;
      if (typeof window !== "undefined") localStorage.setItem("navExpanded", next ? "1" : "0");
      return next;
    });
  }
  const warmAdminRoutes = useCallback(() => {
    for (const item of ALL_NAV) prefetchRoute(item.to);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    nav("/auth");
  }

  const railStyle = { "--rail": `${expanded ? EXPANDED : COLLAPSED}px` } as CSSProperties;

  return (
    <div className="min-h-dvh bg-canvas" style={railStyle}>
      <motion.aside
        initial={false}
        animate={{ width: expanded ? EXPANDED : COLLAPSED }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card px-2.5 py-3 md:flex"
      >
        <SidebarBody expanded={expanded} />
      </motion.aside>

      <div className="transition-[padding] duration-slow ease-out md:pl-[var(--rail)]">
        <header className="sticky top-0 z-30 flex h-[var(--topbar-h)] items-center gap-2 border-b border-border bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={toggle}
            onMouseEnter={warmAdminRoutes}
            onFocus={warmAdminRoutes}
            title="Toggle sidebar"
            aria-label="Toggle sidebar"
            className="hidden h-11 w-11 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:grid lg:h-9 lg:w-9"
          >
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
          <div className="flex min-w-0 items-center gap-2 md:hidden">
            <div className="brand-gradient grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-primary-foreground">J</div>
            <span className="truncate t-card font-semibold tracking-tight">Jeevana Insight</span>
          </div>
          <div className="flex-1" />
          <LangToggle size="sm" />
          <ProfileMenu email={user?.email} onSignOut={signOut} />
        </header>

        <main className="min-h-[calc(100dvh-var(--topbar-h))] pb-bottom-nav md:pb-0">{children}</main>
      </div>

      <BottomNav onSignOut={signOut} />
    </div>
  );
}
