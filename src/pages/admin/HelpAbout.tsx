import { Link } from "react-router-dom";
import {
  HelpCircle,
  Keyboard,
  Volume2,
  Languages,
  ShieldCheck,
  QrCode,
  LayoutTemplate,
  Download,
  BookOpen,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { useT } from "@/lib/i18n";

const APP_VERSION = "1.0";

const HELP_TOPICS: { icon: LucideIcon; title: string; body: string; to?: string }[] = [
  {
    icon: LayoutTemplate,
    title: "Create a survey",
    body: "Start from a validated instrument in Templates, or build one from scratch and pull questions from the Question Library.",
    to: "/app/templates",
  },
  {
    icon: QrCode,
    title: "Share with families",
    body: "Publish a survey, then open QR & Links to get a QR code, a secure link, and one-tap sharing over WhatsApp, SMS or email. Families never sign in.",
    to: "/app/qr",
  },
  {
    icon: Volume2,
    title: "Voice narration",
    body: "Every question can be read aloud in English or Telugu using the device's built-in voices, with pause, replay and speed controls.",
  },
  {
    icon: Languages,
    title: "Two languages",
    body: "The language toggle switches the entire family-facing experience — questions, answers, instructions and buttons — between English and Telugu.",
  },
  {
    icon: Download,
    title: "Export data",
    body: "Download a formatted Excel workbook or a print-ready PDF report from the Export Center at any time.",
    to: "/app/export",
  },
  {
    icon: ShieldCheck,
    title: "Validated instruments",
    body: "The library ships eight research instruments (IRI, CIUS, PID-5-BF, WHO-5 and more). Edits are tracked against the published wording so a modified scale is never mistaken for the original.",
    to: "/app/question-bank",
  },
];

const SHORTCUTS: { keys: string; action: string }[] = [
  { keys: "→", action: "Next question (family assessment)" },
  { keys: "←", action: "Previous question (family assessment)" },
  { keys: "Tab", action: "Move between controls" },
  { keys: "Space / Enter", action: "Select the focused answer" },
];

export default function HelpAbout() {
  const t = useT();

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupSystem")}
        title={t("navHelp")}
        subtitle="A quick guide to the platform, and the details behind it."
      />

      <section className="mt-8">
        <h2 className="flex items-center gap-2 t-section">
          <BookOpen className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />
          Getting started
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {HELP_TOPICS.map((topic) => {
            const inner = (
              <>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-accent-tint">
                  <topic.icon className="h-5 w-5 text-primary" strokeWidth={1.6} />
                </span>
                <div className="min-w-0">
                  <div className="t-card">{topic.title}</div>
                  <p className="mt-1 t-caption leading-relaxed text-muted-foreground">{topic.body}</p>
                </div>
              </>
            );
            return topic.to ? (
              <Link
                key={topic.title}
                to={topic.to}
                className="flex gap-3.5 rounded-surface border border-border/70 bg-card p-4 transition-colors duration-base hover:border-primary/40 hover:bg-muted/40"
              >
                {inner}
              </Link>
            ) : (
              <div key={topic.title} className="flex gap-3.5 rounded-surface border border-border/70 bg-card p-4">
                {inner}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-6 xl:grid-cols-2">
      <section>
        <h2 className="flex items-center gap-2 t-section">
          <Keyboard className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />
          Keyboard shortcuts
        </h2>
        <div className="mt-4 overflow-hidden rounded-surface border border-border/70 bg-card">
          {SHORTCUTS.map((s, i) => (
            <div
              key={s.keys}
              className={`flex items-center justify-between gap-4 px-5 py-3.5 ${i > 0 ? "border-t border-border/60" : ""}`}
            >
              <span className="t-body text-muted-foreground">{s.action}</span>
              <kbd className="rounded-control border border-border bg-muted px-2.5 py-1 font-mono text-xs font-semibold">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 t-section">
          <Shield className="h-5 w-5 text-muted-foreground" strokeWidth={1.6} />
          {t("settingsAbout")}
        </h2>
        <div className="mt-4 rounded-surface border border-border/70 bg-card p-6">
          <div className="flex items-center gap-3">
            <div className="brand-gradient grid h-12 w-12 place-items-center rounded-control t-title font-bold text-primary-foreground">
              J
            </div>
            <div>
              <div className="t-card font-semibold">Jeevana Insight</div>
              <div className="t-caption text-muted-foreground">{t("orgLine")}</div>
            </div>
          </div>
          <dl className="mt-5 divide-y divide-border">
            <Row label="Version" value={APP_VERSION} />
            <Row label="Platform" value={t("orgLine")} />
            <Row label="Support" value="support@jeevanainsight.app" />
          </dl>
          <p className="mt-5 t-caption leading-relaxed text-muted-foreground">
            Built to support family well-being research. Family responses are confidential and used only for
            well-being research and support programmes. Every administrative action is recorded in the{" "}
            <Link to="/app/audit" className="font-medium text-primary link-underline">
              audit log
            </Link>
            .
          </p>
        </div>
      </section>
      </div>
    </PageContainer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="t-caption text-muted-foreground">{label}</dt>
      <dd className="t-body min-w-0 truncate text-right font-medium">{value}</dd>
    </div>
  );
}
