import { useState, type ReactNode, type CSSProperties } from "react";
import { NavLink, useNavigate, Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  ClipboardList,
  Layers,
  Inbox,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeft,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { LangToggle } from "@/components/LangToggle";
import { useT, type DictKey } from "@/lib/i18n";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

const NAV: { to: string; labelKey: DictKey; icon: LucideIcon; end?: boolean }[] = [
  { to: "/app", labelKey: "navOverview", icon: LayoutGrid, end: true },
  { to: "/app/surveys", labelKey: "navSurveys", icon: ClipboardList },
  { to: "/app/question-bank", labelKey: "navQuestionBank", icon: Layers },
  { to: "/app/responses", labelKey: "navResponses", icon: Inbox },
  { to: "/app/analytics", labelKey: "navAnalytics", icon: BarChart3 },
  { to: "/app/reports", labelKey: "navReports", icon: FileText },
  { to: "/app/settings", labelKey: "navSettings", icon: Settings },
];

const COLLAPSED = 64;
const EXPANDED = 240;

type NavT = (typeof NAV)[number];

function NavRow({ item, label, showText, onNavigate, last }: { item: NavT; label: string; showText: boolean; onNavigate?: () => void; last?: boolean }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          // Icon always sits in the SAME place — a fixed-width leading slot — so tabs never jump when collapsing.
          "group relative flex h-10 items-center gap-3 rounded-control px-[11px] transition-colors duration-base ease-out active:scale-[0.98]",
          last && "mt-auto",
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

function SidebarBody({ expanded, onNavigate }: { expanded: boolean; onNavigate?: () => void }) {
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

      <nav className="flex flex-1 flex-col gap-0.5">
        {NAV.map((item, i) => (
          <NavRow key={item.to} item={item} label={t(item.labelKey)} showText={expanded} onNavigate={onNavigate} last={i === NAV.length - 1} />
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
      <DropdownMenuTrigger className="group flex items-center gap-2 rounded-nav border border-border/70 py-1 pl-1 pr-2 transition-colors hover:bg-muted focus:outline-none">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-control bg-primary/10 t-caption font-semibold text-primary">{initial}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block max-w-[130px] truncate t-caption font-medium">{email ?? "Super admin"}</span>
          <span className="block text-eyebrow text-muted-foreground">Administrator</span>
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

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();
  const [expanded, setExpanded] = useState(() => (typeof window !== "undefined" ? localStorage.getItem("navExpanded") !== "0" : true));
  const [mobileOpen, setMobileOpen] = useState(false);

  function toggle() {
    setExpanded((v) => {
      const next = !v;
      if (typeof window !== "undefined") localStorage.setItem("navExpanded", next ? "1" : "0");
      return next;
    });
  }
  async function signOut() {
    await supabase.auth.signOut();
    nav("/auth");
  }

  // Content sits flush beside the rail — exact width, no gap, no overlap.
  const railStyle = { "--rail": `${expanded ? EXPANDED : COLLAPSED}px` } as CSSProperties;

  return (
    <div className="min-h-dvh bg-canvas" style={railStyle}>
      {/* Attached, flush sidebar — no inset, no corner radius. Collapse via the top-bar toggle. */}
      <motion.aside
        initial={false}
        animate={{ width: expanded ? EXPANDED : COLLAPSED }}
        transition={{ type: "spring", stiffness: 340, damping: 36 }}
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-card px-2.5 py-3 lg:flex"
      >
        <SidebarBody expanded={expanded} />
      </motion.aside>

      {/* Mobile drawer with safe area inset */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 z-50 bg-foreground/25 backdrop-blur-sm lg:hidden" 
              onClick={() => setMobileOpen(false)} 
            />
            <motion.aside 
              initial={{ x: "-100%" }} 
              animate={{ x: 0 }} 
              exit={{ x: "-100%" }} 
              transition={{ type: "spring", stiffness: 360, damping: 36 }} 
              className="fixed inset-y-0 left-0 z-50 flex w-full max-w-[320px] flex-col border-r border-border/70 bg-card p-3 lg:hidden safe-area-inset"
            >
              <button onClick={() => setMobileOpen(false)} className="mb-1 ml-auto grid h-9 w-9 place-items-center rounded-xl hover:bg-muted touch-target">
                <X className="h-4 w-4" />
              </button>
              <SidebarBody expanded onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Content column, offset by the rail (+inset+gap) */}
      <div className="transition-[padding] duration-slow ease-out lg:pl-[var(--rail)]">
        {/* Top bar - mobile responsive */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-canvas/80 px-4 backdrop-blur-xl sm:px-6">
          <button onClick={toggle} title="Toggle sidebar" className="hidden h-9 w-9 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:grid touch-target">
            <PanelLeft className="h-[18px] w-[18px]" />
          </button>
          <button onClick={() => setMobileOpen(true)} className="grid h-9 w-9 place-items-center rounded-xl border border-border/70 lg:hidden touch-target">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 lg:hidden">
            <div className="brand-gradient grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-primary-foreground">J</div>
            <span className="text-sm font-semibold tracking-tight">Jeevana Insight</span>
          </div>
          <div className="flex-1" />
          <LangToggle size="sm" />
          <ProfileMenu email={user?.email} onSignOut={signOut} />
        </header>

        <main className="min-h-[calc(100dvh-3.5rem)] pb-safe">{children}</main>
      </div>
    </div>
  );
}
