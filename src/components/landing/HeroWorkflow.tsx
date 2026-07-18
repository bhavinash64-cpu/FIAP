import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion, useMotionValue, useSpring, type Transition } from "framer-motion";
import { ClipboardList, QrCode, Users, Inbox, BarChart3, FileText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDesktopMotion } from "@/components/landing/motion";

/**
 * The hero centerpiece: the platform's actual pipeline, not an illustration.
 * Each node carries a miniature of the real feature it represents — a question
 * card, a QR block, a bilingual toggle, stored response rows, a chart, a report
 * — so the panel answers "what does this system do?" before a word is read.
 *
 * A highlight walks the six stages on a timer to trace the flow; it is purely
 * ambient and pauses for prefers-reduced-motion.
 */

type Loop = { animate: Record<string, number[]>; transition: Transition };
type Stage = { key: string; label: string; caption: string; icon: LucideIcon; visual: () => JSX.Element; loop: Loop };

// Each miniature breathes on its own clock — different property, duration and
// delay — so no two ever move together. Pure transform loops (GPU, 60fps).
const loop = (animate: Record<string, number[]>, duration: number, delay = 0): Loop => ({
  animate,
  transition: { duration, delay, repeat: Infinity, ease: "easeInOut" },
});

const STAGES: Stage[] = [
  { key: "build", label: "Create assessment", caption: "Validated instruments", icon: ClipboardList, visual: BuildVisual, loop: loop({ y: [0, -6, 0] }, 8, 0) },
  { key: "qr", label: "Generate QR", caption: "Secure link", icon: QrCode, visual: QrVisual, loop: loop({ rotate: [-2, 2, -2] }, 12, 0.6) },
  { key: "respond", label: "Family responds", caption: "Bilingual, no login", icon: Users, visual: RespondVisual, loop: loop({ scale: [1, 1.02, 1] }, 8, 0.3) },
  { key: "store", label: "Responses stored", caption: "Structured & secure", icon: Inbox, visual: StoreVisual, loop: loop({ y: [0, -3, 0] }, 9, 1.1) },
  { key: "analyze", label: "Analytics", caption: "Live breakdowns", icon: BarChart3, visual: AnalyzeVisual, loop: loop({ y: [0, -4, 0] }, 10, 0.5) },
  { key: "report", label: "Research reports", caption: "Printable & export", icon: FileText, visual: ReportVisual, loop: loop({ y: [0, -6, 0] }, 8.5, 0.9) },
];

export function HeroWorkflow() {
  const reduce = useReducedMotion();
  const tiltOn = useDesktopMotion();
  const [active, setActive] = useState(0);

  // Pointer-reactive tilt — the panel leans toward the cursor by up to ±2°,
  // springs back on leave. Desktop + fine-pointer only.
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 150, damping: 15, mass: 0.5 });
  const sry = useSpring(ry, { stiffness: 150, damping: 15, mass: 0.5 });

  function onMove(e: React.MouseEvent) {
    if (!tiltOn || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    rx.set(-py * 4); // ±0.5 → ±2°
    ry.set(px * 4);
  }
  function reset() { rx.set(0); ry.set(0); }

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setActive((i) => (i + 1) % STAGES.length), 2200);
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="relative w-full [perspective:1400px]">
      {/* Application window frame — reads as "a real console", not artwork. */}
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={reset}
        style={tiltOn ? { rotateX: srx, rotateY: sry, transformStyle: "preserve-3d" } : undefined}
        className="overflow-hidden rounded-3xl border border-border bg-card shadow-[0_1px_3px_rgba(20,20,25,0.04),0_24px_48px_-24px_rgba(20,20,25,0.18)]"
      >
        {/* Title bar */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
            <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
          </div>
          <div className="flex-1 text-center t-caption font-medium text-muted-foreground">
            Assessment workflow
          </div>
          <span className="rounded-lg bg-accent px-2 py-0.5 text-[11px] font-semibold text-primary">Live</span>
        </div>

        {/* Pipeline */}
        <div className="relative p-4 sm:p-6">
          <ol className="relative space-y-3">
            {/* Spine connecting the nodes */}
            <span aria-hidden className="absolute left-[27px] top-6 bottom-6 w-px bg-border sm:left-[31px]" />
            {STAGES.map((stage, i) => (
              <StageRow key={stage.key} stage={stage} index={i} active={i === active} onHover={() => setActive(i)} reduce={reduce} />
            ))}
          </ol>
        </div>
      </motion.div>
    </div>
  );
}

function StageRow({ stage, index, active, onHover, reduce }: { stage: Stage; index: number; active: boolean; onHover: () => void; reduce: boolean }) {
  const Visual = stage.visual;
  return (
    <li
      onMouseEnter={onHover}
      className={cn(
        "relative flex items-center gap-3 rounded-2xl border p-3 transition-[background-color,border-color,box-shadow,transform] duration-[250ms] sm:gap-4",
        active
          ? "border-primary/30 bg-accent/60 shadow-[0_1px_2px_rgba(20,20,25,0.03),0_8px_24px_-12px_rgba(91,76,247,0.28)]"
          : "border-transparent bg-transparent",
      )}
      style={{ transform: active ? "scale(1.01)" : "scale(1)" }}
    >
      {/* Node marker */}
      <span
        className={cn(
          "relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-2xl border transition-colors duration-[250ms] sm:h-[52px] sm:w-[52px]",
          active ? "border-primary/30 bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
        )}
      >
        <stage.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </span>

      {/* Label */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] font-semibold tabular-nums text-tertiary">{String(index + 1).padStart(2, "0")}</span>
          <span className={cn("truncate t-card font-semibold", active ? "text-foreground" : "text-foreground/80")}>{stage.label}</span>
        </div>
        <div className="truncate t-caption text-muted-foreground">{stage.caption}</div>
      </div>

      {/* Miniature of the real feature — breathing on its own clock. */}
      <motion.div
        className="hidden shrink-0 xs:block will-change-transform"
        animate={reduce ? undefined : stage.loop.animate}
        transition={reduce ? undefined : stage.loop.transition}
      >
        <Visual />
      </motion.div>
    </li>
  );
}

/* ── Feature miniatures — each mirrors a real surface of the product ─────── */

function Chip({ w = 40, tone = "muted" }: { w?: number; tone?: "muted" | "primary" | "faint" }) {
  const bg = tone === "primary" ? "bg-primary/70" : tone === "faint" ? "bg-border-strong" : "bg-muted-foreground/25";
  return <span className={cn("block h-1.5 rounded-full", bg)} style={{ width: w }} />;
}

function BuildVisual() {
  return (
    <div className="w-[104px] rounded-xl border border-border bg-card p-2.5">
      <Chip w={72} tone="faint" />
      <div className="mt-2 space-y-1.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-full border", i === 1 ? "border-primary bg-primary" : "border-border-strong")} />
            <Chip w={i === 1 ? 56 : 44} tone={i === 1 ? "primary" : "muted"} />
          </div>
        ))}
      </div>
    </div>
  );
}

function QrVisual() {
  // A recognisable QR silhouette from a deterministic cell pattern.
  const cells = [
    1, 1, 1, 0, 1, 0, 1,
    1, 0, 1, 0, 0, 1, 1,
    1, 1, 0, 1, 1, 0, 1,
    0, 0, 1, 0, 1, 1, 0,
    1, 1, 0, 1, 0, 0, 1,
    1, 0, 1, 1, 0, 1, 0,
    1, 1, 0, 0, 1, 1, 1,
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-2">
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((c, i) => (
          <span key={i} className={cn("h-[6px] w-[6px] rounded-[1px]", c ? "bg-foreground" : "bg-transparent")} />
        ))}
      </div>
    </div>
  );
}

function RespondVisual() {
  return (
    <div className="w-[104px] rounded-xl border border-border bg-card p-2.5">
      <div className="mb-2 flex overflow-hidden rounded-lg border border-border text-[9px] font-semibold">
        <span className="flex-1 bg-primary py-0.5 text-center text-primary-foreground">EN</span>
        <span className="flex-1 py-0.5 text-center text-muted-foreground">తె</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-accent/60 px-1.5 py-1">
        <span className="grid h-3 w-3 place-items-center rounded-full bg-primary text-[7px] text-primary-foreground">✓</span>
        <Chip w={48} tone="primary" />
      </div>
    </div>
  );
}

function StoreVisual() {
  return (
    <div className="w-[104px] space-y-1.5 rounded-xl border border-border bg-card p-2.5">
      {[52, 44, 60].map((w, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="grid h-3 w-3 place-items-center rounded-[3px] bg-success/15 text-[7px] text-success">✓</span>
          <Chip w={w} tone="muted" />
        </div>
      ))}
    </div>
  );
}

function AnalyzeVisual() {
  const bars = [9, 16, 12, 22, 18];
  return (
    <div className="flex h-[52px] w-[104px] items-end gap-1.5 rounded-xl border border-border bg-card p-2.5">
      {bars.map((h, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-t-[2px]", i === 3 ? "bg-primary" : "bg-primary/30")}
          style={{ height: h }}
        />
      ))}
    </div>
  );
}

function ReportVisual() {
  return (
    <div className="w-[104px] rounded-xl border border-border bg-card p-2.5">
      <div className="space-y-1">
        <Chip w={40} tone="faint" />
        <Chip w={64} tone="muted" />
        <Chip w={56} tone="muted" />
      </div>
      <div className="mt-2 h-4 rounded bg-gradient-to-r from-primary/25 to-primary/5" />
    </div>
  );
}
