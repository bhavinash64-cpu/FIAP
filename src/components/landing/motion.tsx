import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion, useScroll, useSpring, useTransform, useReducedMotion, useMotionValue,
  animate, useInView, type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Premium motion primitives for the landing surface.
 *
 * Principles held throughout:
 *  • transform / opacity / filter only — never width, height, top or left, so
 *    everything composites on the GPU and holds 60fps.
 *  • one easing voice — PREMIUM_EASE — so nothing feels borrowed from a
 *    different app.
 *  • prefers-reduced-motion collapses every effect to a plain fade (or nothing);
 *    parallax and pointer reactions switch off entirely.
 *  • desktop-only flourishes (parallax, magnetic pull, tilt) are gated on a
 *    fine pointer + width, never shipped to a phone.
 */

export const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

/** True on a real desktop with a precise pointer — the only place parallax and
 *  magnetic effects run. Reduced-motion always returns false. */
export function useDesktopMotion(): boolean {
  const reduce = useReducedMotion();
  const [ok, setOk] = useState(false);
  useEffect(() => {
    if (reduce) return;
    const mq = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [reduce]);
  return ok;
}

/** Sets a boolean once the page has scrolled past `threshold`px. */
export function useScrolled(threshold = 8): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > threshold);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [threshold]);
  return scrolled;
}

/* ── Scroll progress rail ──────────────────────────────────────────────── */

export function ScrollProgress() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  // Under reduced motion, bind straight to progress (no spring smoothing/lag,
  // so it never keeps animating after the user stops scrolling).
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });
  const scaleX = reduce ? scrollYProgress : smooth;
  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-primary to-[hsl(246_100%_71%)]"
    />
  );
}

/* ── Section reveal — opacity 0→1, y 20→0, ~800ms ──────────────────────── */

export function Reveal({
  children, className, delay = 0, y = 20, once = true,
}: { children: ReactNode; className?: string; delay?: number; y?: number; once?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-12% 0px -12% 0px" }}
      transition={{ duration: 0.8, ease: PREMIUM_EASE, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── Heading — each line rises out of a mask, staggered ────────────────── */

export function RevealHeading({
  lines, className, as = "h2", immediate = false,
}: { lines: string[]; className?: string; as?: "h1" | "h2"; immediate?: boolean }) {
  const reduce = useReducedMotion();
  const MotionTag = (motion as unknown as Record<string, typeof motion.h1>)[as];
  const parent = { hidden: {}, show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: 0.02 } } };
  const child = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: "110%" },
    show: { opacity: 1, y: "0%", transition: { duration: 0.85, ease: PREMIUM_EASE } },
  };
  const trigger = immediate
    ? { animate: "show" as const }
    : { whileInView: "show" as const, viewport: { once: true, margin: "-10%" } };

  return (
    <MotionTag className={className} variants={parent} initial="hidden" {...trigger}>
      {lines.map((line, i) => (
        // pb/-mb pair keeps descenders from being clipped by the mask.
        <span key={i} className="block overflow-hidden pb-[0.08em] -mb-[0.08em]">
          {/* framer toggles will-change during the animation itself, so no
              permanent will-change class is needed here. */}
          <motion.span variants={child} className="block">{line}</motion.span>
        </span>
      ))}
    </MotionTag>
  );
}

/* ── Magnetic pull — element drifts toward the cursor, springs back ────── */

export function Magnetic({ children, strength = 6, className }: { children: ReactNode; strength?: number; className?: string }) {
  const enabled = useDesktopMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });

  function onMove(e: React.MouseEvent) {
    if (!enabled || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const clamp = (v: number) => Math.max(-strength, Math.min(strength, v));
    x.set(clamp(dx * 0.3));
    y.set(clamp(dy * 0.3));
  }
  function reset() { x.set(0); y.set(0); }

  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={reset} style={{ x: sx, y: sy }} className={cn("inline-block", className)}>
      {children}
    </motion.div>
  );
}

/* ── Count up when scrolled into view ──────────────────────────────────── */

export function CountInView({ value, className, suffix = "" }: { value: number; className?: string; suffix?: string }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) return;
    const controls = animate(0, value, {
      duration: 1.5,
      ease: PREMIUM_EASE,
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value, reduce]);

  return <span ref={ref} className={className}>{display.toLocaleString()}{suffix}</span>;
}

/* ── Subtle scroll parallax (desktop only) ─────────────────────────────── */

export function Parallax({ children, distance = 10, className }: { children: ReactNode; distance?: number; className?: string }) {
  const enabled = useDesktopMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const raw = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const y = useSpring(raw, { stiffness: 90, damping: 24, mass: 0.4 }) as MotionValue<number>;

  return (
    <div ref={ref} className={className}>
      <motion.div style={enabled ? { y } : undefined}>{children}</motion.div>
    </div>
  );
}
