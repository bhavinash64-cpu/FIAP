import { NavLink, useNavigate } from "react-router-dom";
import { Shield, FileQuestion, ScrollText, LogOut, FileBarChart2 } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LangToggle } from "@/components/LangToggle";
import { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const nav = useNavigate();

  const items = [
    { to: "/app/surveys", label: "Surveys", icon: FileQuestion },
    { to: "/app/reports", label: "Reports", icon: FileBarChart2 },
    { to: "/app/audit", label: "Audit log", icon: ScrollText },
  ];

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 h-16 flex items-center gap-3">
          <NavLink to="/app/surveys" className="flex items-center gap-2.5 group">
            <motion.div
              whileHover={{ rotate: -6, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="h-9 w-9 rounded-xl brand-gradient grid place-items-center shadow-md"
            >
              <Shield className="h-5 w-5 text-primary-foreground" />
            </motion.div>
            <div className="hidden md:block leading-tight">
              <div className="text-sm font-semibold tracking-tight">APFAP</div>
              <div className="text-[11px] text-muted-foreground">AP Police</div>
            </div>
          </NavLink>

          <nav className="ml-4 hidden lg:flex items-center gap-1">
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) =>
                  `relative px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "text-accent-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="nav-pill"
                        className="absolute inset-0 rounded-lg bg-accent"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative flex items-center">
                      <i.icon className="h-4 w-4 mr-1.5" />
                      {i.label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            <Badge variant="secondary" className="hidden sm:inline-flex rounded-lg">Super admin</Badge>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={async () => {
                await supabase.auth.signOut();
                nav("/auth");
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className="lg:hidden border-t border-border/60 overflow-x-auto no-scrollbar">
          <div className="flex gap-1 px-3 py-2 min-w-max">
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                  }`
                }
              >
                <i.icon className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                {i.label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 py-4 text-center text-[11px] text-muted-foreground">
        {user?.email} · Government of Andhra Pradesh — Department of Police
      </footer>
    </div>
  );
}
