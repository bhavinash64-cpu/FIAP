import { type ReactNode } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTheme } from "next-themes";
import {
  User,
  Languages,
  Volume2,
  Accessibility,
  Sun,
  Moon,
  Monitor,
  Bell,
  ShieldCheck,
  FlaskConical,
  ScrollText,
  LogOut,
  Play,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LangToggle } from "@/components/LangToggle";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLang, useT } from "@/lib/i18n";
import { useVoiceSettings, useNarrator, VOICE_RATES, speechSupported } from "@/lib/voice";
import { usePreferences } from "@/lib/preferences";
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const t = useT();

  async function signOut() {
    await supabase.auth.signOut();
    nav("/auth");
  }

  return (
    <PageContainer>
      <PageHeader eyebrow={t("navGroupSystem")} title={t("settingsTitle")} />

      {/* Masonry-ish two columns on wide screens so sections fill the width
          instead of stacking in a narrow centred strip. */}
      <div className="mt-8 grid items-start gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <GeneralSection email={user?.email} />
          <LanguageSection />
          <VoiceSection />
          <AccessibilitySection />
        </div>
        <div className="space-y-6">
          <ThemeSection />
          <NotificationsSection />
          <SecuritySection />
          <ResearchSection />

          <Section icon={LogOut} title={t("signOut")}>
            <div className="flex items-center justify-between gap-4">
              <p className="t-caption text-muted-foreground">End this administrator session.</p>
              <Button variant="outline" onClick={signOut} className="shrink-0">
                <LogOut strokeWidth={1.6} />
                {t("signOut")}
              </Button>
            </div>
          </Section>
        </div>
      </div>
    </PageContainer>
  );
}

// ── Section frame ────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="rounded-surface border border-border/70 bg-card p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.6} />
        <h2 className="t-card">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block t-body font-medium">{label}</span>
        <span className="mt-0.5 block t-caption text-muted-foreground">{description}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-1 shrink-0" aria-label={label} />
    </label>
  );
}

// ── Sections ────────────────────────────────────────────────────────────────

function GeneralSection({ email }: { email?: string }) {
  const t = useT();
  return (
    <Section icon={User} title={t("settingsGeneral")}>
      <dl className="divide-y divide-border">
        <div className="flex items-center justify-between gap-4 py-3 first:pt-0">
          <dt className="t-body text-muted-foreground">Signed in as</dt>
          <dd className="min-w-0 truncate t-body font-medium">{email ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-3 last:pb-0">
          <dt className="t-body text-muted-foreground">Role</dt>
          <dd className="t-body font-medium">Super admin — full access</dd>
        </div>
      </dl>
    </Section>
  );
}

function LanguageSection() {
  const t = useT();
  return (
    <Section icon={Languages} title={t("settingsLanguage")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xs t-caption text-muted-foreground">{t("languageDesc")}</p>
        <LangToggle />
      </div>
    </Section>
  );
}

function VoiceSection() {
  const t = useT();
  const lang = useLang();
  const autoplay = useVoiceSettings((s) => s.autoplay);
  const setAutoplay = useVoiceSettings((s) => s.setAutoplay);
  const rate = useVoiceSettings((s) => s.rate);
  const setRate = useVoiceSettings((s) => s.setRate);
  const narrator = useNarrator(lang);

  return (
    <Section icon={Volume2} title={t("settingsVoice")}>
      {!speechSupported() ? (
        <p className="t-caption text-muted-foreground">{t("voiceUnavailable")}</p>
      ) : (
        <div className="divide-y divide-border">
          <ToggleRow
            label={t("voiceAutoplay")}
            description={t("voiceAutoplayDesc")}
            checked={autoplay}
            onChange={setAutoplay}
          />
          <div className="py-3">
            <div className="flex items-center justify-between gap-4">
              <span className="t-body font-medium">{t("voiceDefaultSpeed")}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => narrator.speak(t("voiceTestPhrase"))}
                disabled={!narrator.available}
              >
                <Play strokeWidth={1.8} />
                {t("voiceTest")}
              </Button>
            </div>
            <div className="mt-2 flex gap-1.5">
              {VOICE_RATES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRate(r)}
                  aria-pressed={rate === r}
                  className={cn(
                    "h-10 flex-1 rounded-control text-sm font-semibold tabular-nums transition-colors",
                    "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    rate === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function AccessibilitySection() {
  const t = useT();
  const largeText = usePreferences((s) => s.largeText);
  const setLargeText = usePreferences((s) => s.setLargeText);
  const highContrast = usePreferences((s) => s.highContrast);
  const setHighContrast = usePreferences((s) => s.setHighContrast);

  return (
    <Section icon={Accessibility} title={t("settingsAccessibility")}>
      <div className="divide-y divide-border">
        <ToggleRow label={t("largeText")} description={t("largeTextDesc")} checked={largeText} onChange={setLargeText} />
        <ToggleRow
          label={t("highContrast")}
          description={t("highContrastDesc")}
          checked={highContrast}
          onChange={setHighContrast}
        />
      </div>
    </Section>
  );
}

function ThemeSection() {
  const t = useT();
  const { theme, setTheme } = useTheme();
  const options: { value: string; label: string; icon: LucideIcon }[] = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ];

  return (
    <Section icon={Sun} title={t("settingsTheme")}>
      <p className="mb-3 t-caption text-muted-foreground">{t("themeDesc")}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = (theme ?? "system") === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => setTheme(o.value)}
              aria-pressed={active}
              className={cn(
                "flex h-20 flex-col items-center justify-center gap-2 rounded-surface border-2 transition-colors",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                active ? "border-primary bg-accent text-primary" : "border-border text-muted-foreground hover:border-primary/40",
              )}
            >
              <o.icon className="h-5 w-5" strokeWidth={1.7} />
              <span className="t-caption font-medium">{o.label}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function NotificationsSection() {
  const t = useT();
  return (
    <Section icon={Bell} title={t("settingsNotifications")}>
      <div className="flex items-center justify-between gap-4">
        <p className="max-w-md t-caption text-muted-foreground">
          Platform activity — new surveys, publishing, imports — is recorded and shown in the Notification Center.
        </p>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/app/notifications">
            <Bell strokeWidth={1.6} />
            {t("navNotifications")}
          </Link>
        </Button>
      </div>
    </Section>
  );
}

function SecuritySection() {
  const t = useT();
  return (
    <Section icon={ShieldCheck} title={t("settingsSecurity")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-md t-caption leading-relaxed text-muted-foreground">
          This is the single super-admin account. Public sign-up is disabled, families never authenticate, and every
          administrative action is recorded in the audit log.
        </p>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/app/audit">
            <ScrollText strokeWidth={1.6} />
            {t("navAudit")}
          </Link>
        </Button>
      </div>
    </Section>
  );
}

function ResearchSection() {
  const t = useT();
  return (
    <Section icon={FlaskConical} title={t("settingsResearch")}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <p className="max-w-md t-caption leading-relaxed text-muted-foreground">
          Eight validated instruments ship with the platform. Manage their wording, scales and translations in the
          Question Library — edits are tracked against the published form.
        </p>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link to="/app/question-bank">
            <FlaskConical strokeWidth={1.6} />
            {t("navQuestionBank")}
          </Link>
        </Button>
      </div>
    </Section>
  );
}
