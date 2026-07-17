import { useNavigate, Link } from "react-router-dom";
import { User, Languages, ShieldCheck, ScrollText, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LangToggle } from "@/components/LangToggle";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();

  async function signOut() {
    await supabase.auth.signOut();
    nav("/auth");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="eyebrow">Account</div>
        <h1 className="t-title mt-2">Settings</h1>
      </header>

      <div className="mt-8 space-y-6">
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="eyebrow">Administrator</span>
          </div>
          <div className="divide-y divide-border">
            <Row label="Signed in as" value={user?.email ?? "—"} />
            <Row label="Role" value="Super admin — full access" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <span className="t-card">Language</span>
              </div>
              <p className="t-caption text-muted-foreground mt-1 max-w-xs">Choose how content is shown across the console and surveys.</p>
            </div>
            <LangToggle />
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <span className="eyebrow">Security</span>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <p className="t-body text-muted-foreground max-w-md">
              This is the single super-admin account for the platform. Public sign-up is disabled, and every administrative action is recorded in the audit log.
            </p>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/app/audit"><ScrollText strokeWidth={1.5} />View audit log</Link>
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="t-card">Sign out</div>
              <p className="t-caption text-muted-foreground mt-1">End this administrator session.</p>
            </div>
            <Button variant="outline" onClick={signOut}>
              <LogOut strokeWidth={1.5} /> Sign out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <span className="t-card shrink-0">{label}</span>
      <span className="t-body text-muted-foreground min-w-0 flex-1 truncate text-right">{value}</span>
    </div>
  );
}
