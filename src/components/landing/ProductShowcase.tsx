import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Lock, ClipboardList, Library, BarChart3, LayoutGrid, Users, Inbox, FileText, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A framed, tabbed preview of the real console surfaces. These are faithful
 * in-DOM recreations of the actual pages — the same layout, type and controls —
 * not stock dashboard art. They are representative (static, illustrative data),
 * which is why the frame is labelled with the real route it mirrors.
 */

const TABS = [
  { key: "dashboard", label: "Dashboard", path: "/app", render: DashboardScreen },
  { key: "builder", label: "Survey Builder", path: "/app/surveys/·/edit", render: BuilderScreen },
  { key: "library", label: "Question Library", path: "/app/masters", render: LibraryScreen },
  { key: "analytics", label: "Analytics", path: "/app/analytics", render: AnalyticsScreen },
  { key: "assessment", label: "Family Assessment", path: "/s/·", render: AssessmentScreen },
] as const;

export function ProductShowcase() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("dashboard");
  const reduce = useReducedMotion();
  const active = TABS.find((t) => t.key === tab)!;
  const Screen = active.render;

  return (
    <div>
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-xl border px-3.5 py-2 t-caption font-semibold transition-colors duration-[250ms]",
              t.key === tab
                ? "border-primary/30 bg-accent text-primary"
                : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Browser frame */}
      <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_3px_rgba(20,20,25,0.04),0_24px_56px_-28px_rgba(20,20,25,0.22)]">
        <div className="flex items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          </div>
          <div className="mx-auto flex w-full max-w-sm items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-1">
            <Lock className="h-3 w-3 text-tertiary" strokeWidth={2} />
            <span className="truncate text-[11px] text-muted-foreground">psydigihealth.app{active.path}</span>
          </div>
        </div>

        <div className="relative h-[320px] overflow-hidden bg-canvas sm:h-[380px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
              transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
              className="absolute inset-0"
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ── Shared console chrome ─────────────────────────────────────────────── */

function ConsoleShell({ active, children }: { active: string; children: React.ReactNode }) {
  const nav = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
    { key: "surveys", label: "Surveys", icon: ClipboardList },
    { key: "library", label: "Question Library", icon: Library },
    { key: "responses", label: "Responses", icon: Inbox },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];
  return (
    <div className="flex h-full text-foreground">
      <aside className="hidden w-[168px] shrink-0 flex-col gap-0.5 border-r border-border bg-card p-3 sm:flex">
        <div className="mb-3 flex items-center gap-2 px-1">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">P</span>
          <span className="t-caption font-semibold">PsyDigiHealth</span>
        </div>
        {nav.map((n) => (
          <div
            key={n.key}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium",
              n.key === active ? "bg-accent text-primary" : "text-muted-foreground",
            )}
          >
            <n.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
            {n.label}
          </div>
        ))}
      </aside>
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
    </div>
  );
}

function MiniBar({ w, label, tone = "muted" }: { w: number; label?: string; tone?: "muted" | "primary" }) {
  return (
    <div className="flex items-center gap-2">
      {label && <span className="w-16 shrink-0 truncate text-[10px] text-muted-foreground">{label}</span>}
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <span className={cn("block h-full rounded-full", tone === "primary" ? "bg-primary" : "bg-primary/40")} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

/* ── Screens ────────────────────────────────────────────────────────────── */

function DashboardScreen() {
  return (
    <ConsoleShell active="dashboard">
      <div className="p-4 sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Overview</div>
        <div className="mt-1 t-card font-semibold">Research that protects tomorrow.</div>
        <div className="mt-4 grid grid-cols-4 gap-2.5">
          {[
            { icon: ClipboardList, v: "12", l: "Active surveys" },
            { icon: Inbox, v: "1,248", l: "Responses" },
            { icon: Layers, v: "128", l: "Bank questions" },
            { icon: BarChart3, v: "83%", l: "Publish rate" },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-2.5">
              <span className="grid h-6 w-6 place-items-center rounded-lg bg-accent text-primary">
                <k.icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              </span>
              <div className="mt-2 t-card font-semibold tabular-nums">{k.v}</div>
              <div className="text-[10px] text-muted-foreground">{k.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <div className="col-span-2 rounded-xl border border-border bg-card p-3">
            <div className="text-[11px] font-semibold">Responses over time</div>
            <div className="mt-3 flex h-[86px] items-end gap-1.5">
              {[30, 42, 38, 55, 48, 62, 58, 70, 66, 78, 72, 88].map((h, i) => (
                <span key={i} className="flex-1 rounded-t-[2px] bg-primary/30" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="text-[11px] font-semibold">Survey status</div>
            <div className="mt-3 space-y-2">
              <MiniBar w={70} label="Published" tone="primary" />
              <MiniBar w={40} label="Draft" />
              <MiniBar w={22} label="Closed" />
            </div>
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}

function BuilderScreen() {
  return (
    <ConsoleShell active="surveys">
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-semibold">Family Well-being Survey</div>
          <span className="rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">Published</span>
        </div>
        <div className="mt-3 space-y-2.5">
          {[
            { n: "01", q: "I have felt cheerful and in good spirits.", sel: 4 },
            { n: "02", q: "I have felt calm and relaxed.", sel: 3 },
          ].map((item) => (
            <div key={item.n} className="rounded-xl border border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold tabular-nums text-tertiary">{item.n}</span>
                <span className="rounded-md bg-accent px-1.5 py-0.5 text-[9px] font-semibold text-primary">Radio · pick one</span>
              </div>
              <div className="mt-2 text-[12px] font-medium">{item.q}</div>
              <div className="mt-2 flex gap-1.5">
                {[0, 1, 2, 3, 4].map((o) => (
                  <span
                    key={o}
                    className={cn(
                      "grid h-6 w-6 place-items-center rounded-lg border text-[10px] font-semibold",
                      o === item.sel ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground",
                    )}
                  >
                    {o + 1}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-[11px] font-medium text-muted-foreground">
            + Add question
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}

function LibraryScreen() {
  const items = [
    { c: "WHO-5", n: "5", d: "Well-Being Index" },
    { c: "IRI", n: "28", d: "Interpersonal Reactivity" },
    { c: "BDI", n: "21", d: "Beck Depression Inventory" },
    { c: "PID-5-BF", n: "25", d: "Personality Inventory" },
  ];
  return (
    <ConsoleShell active="library">
      <div className="p-4 sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Masters</div>
        <div className="mt-1 t-card font-semibold">Question Library</div>
        <div className="mt-3 space-y-2">
          {items.map((it) => (
            <div key={it.c} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <Layers className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-semibold">{it.c}</div>
                <div className="truncate text-[10px] text-muted-foreground">{it.d}</div>
              </div>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">{it.n}</span>
              <span className="rounded-full bg-success/12 px-2 py-0.5 text-[10px] font-semibold text-success">Validated</span>
            </div>
          ))}
        </div>
      </div>
    </ConsoleShell>
  );
}

function AnalyticsScreen() {
  return (
    <ConsoleShell active="analytics">
      <div className="p-4 sm:p-5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary">Insight</div>
        <div className="mt-1 t-card font-semibold">Analytics</div>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {[
            { v: "1,248", l: "Responses" },
            { v: "94%", l: "Completion" },
            { v: "3m 12s", l: "Avg. time" },
          ].map((k, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-2.5">
              <div className="t-card font-semibold tabular-nums">{k.v}</div>
              <div className="text-[10px] text-muted-foreground">{k.l}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] font-semibold">Per-question breakdown · WHO-5 Q1</div>
          <div className="mt-3 space-y-2">
            <MiniBar w={12} label="At no time" />
            <MiniBar w={28} label="Some time" />
            <MiniBar w={64} label="Most time" tone="primary" />
            <MiniBar w={40} label="All the time" />
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}

function AssessmentScreen() {
  // The respondent-facing view — no console shell, just the public form.
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-accent/40 to-canvas">
      <div className="flex items-center gap-2 border-b border-border/60 bg-card/80 px-4 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-[11px] font-bold text-primary-foreground">
          <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="text-[11px] font-semibold">PsyDigiHealth · Family Assessment</span>
        <span className="ml-auto flex overflow-hidden rounded-lg border border-border text-[9px] font-semibold">
          <span className="bg-primary px-1.5 py-0.5 text-primary-foreground">EN</span>
          <span className="px-1.5 py-0.5 text-muted-foreground">తెలుగు</span>
        </span>
      </div>
      <div className="h-1 bg-muted">
        <span className="block h-full w-2/5 bg-primary" />
      </div>
      <div className="mx-auto w-full max-w-md space-y-3 p-4">
        <div className="rounded-xl border border-border bg-card p-3.5">
          <div className="text-[10px] text-muted-foreground">Question 2 of 5</div>
          <div className="mt-1.5 text-[13px] font-semibold leading-snug">I have felt calm and relaxed.</div>
          <div className="mt-1 text-[11px] text-muted-foreground">నేను ప్రశాంతంగా, విశ్రాంతిగా ఉన్నాను.</div>
          <div className="mt-3 space-y-1.5">
            {["Most of the time", "More than half the time", "Less than half the time"].map((o, i) => (
              <div
                key={o}
                className={cn(
                  "flex items-center gap-2 rounded-lg border p-2 text-[11px]",
                  i === 0 ? "border-primary bg-accent/60 font-medium text-foreground" : "border-border text-muted-foreground",
                )}
              >
                <span className={cn("grid h-3.5 w-3.5 place-items-center rounded-full border-2", i === 0 ? "border-primary bg-primary" : "border-border-strong")}>
                  {i === 0 && <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground" />}
                </span>
                {o}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
