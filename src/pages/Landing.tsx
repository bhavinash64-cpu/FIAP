import { Link } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ArrowRight, Lock, ShieldCheck, Compass, HeartPulse, Building2 } from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { BrandMark } from "@/components/BrandMark";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/* ────────────────────────────────────────────────────────────────────────
   Jeevana Insight — Landing
   One purpose: an elegant, calm entrance that earns the click on "Sign in".
   Typography leads; the illustration is an abstract composition of insight —
   floating research cards, three intersecting circles, soft concentric rings.
   Every color/radius/shadow/spacing value comes from the design token system.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.33, 1, 0.68, 1] as const; // --ease-out


export default function Landing() {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: reduce ? 0 : 0.05 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas text-foreground">
      {/* Ambient lighting — one indigo family, faint, fades to transparent */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-14%] h-[46rem] w-[46rem] -translate-x-1/2 rounded-pill bg-[radial-gradient(circle,hsl(var(--accent-lavender)/0.16),transparent_62%)]" />
        <div className="absolute right-[-10%] top-[6%] h-[34rem] w-[34rem] rounded-pill bg-[radial-gradient(circle,hsl(var(--primary)/0.07),transparent_65%)]" />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.header
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
        className="mx-auto flex max-w-[1240px] items-center gap-3 px-6 py-6 sm:px-8"
      >
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-control bg-surface shadow-sm ring-1 ring-border">
            <BrandMark className="h-6 w-6" />
          </span>
          <span className="leading-tight">
            <span className="t-caption block font-semibold text-foreground">Jeevana Insight</span>
            <span className="t-caption block text-tertiary">Family Assessment Platform</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-3">
          <LangToggle />
          <Button asChild className="group">
            <Link to="/auth">
              Sign in
              <ArrowRight className="transition-transform duration-base ease-out group-hover:translate-x-1" strokeWidth={1.5} />
            </Link>
          </Button>
        </div>
      </motion.header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-6 pb-8 pt-8 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-8 lg:pt-16">
        {/* Copy */}
        <motion.div initial="hidden" animate="show" variants={container} className="max-w-xl">
          <motion.p variants={item} className="eyebrow text-primary">
            Research · Understand · Empower
          </motion.p>

          <motion.h1 variants={item} className="font-editorial t-hero mt-6 font-normal">
            Understand every story.
            <br />
            Build a <span className="italic text-primary">better tomorrow.</span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-md t-body text-muted-foreground">
            A secure, intelligent space to collect, understand and turn family insights into
            meaningful action — made for researchers and professionals who care.
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-col items-start gap-4">
            <Button
              asChild
              size="lg"
              className="group shadow-[var(--highlight-top),var(--shadow-md)] transition-[transform,box-shadow,background-color] duration-base ease-out hover:-translate-y-px hover:shadow-[var(--highlight-top),var(--shadow-float)] active:translate-y-0"
            >
              <Link to="/auth">
                <Lock className="opacity-80" strokeWidth={1.5} />
                Sign in to continue
                <ArrowRight className="transition-transform duration-base ease-out group-hover:translate-x-1" strokeWidth={1.5} />
              </Link>
            </Button>

            <div className="flex items-center gap-2 t-caption text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-primary/70" strokeWidth={1.5} />
              Private · Secure · Built with trust
            </div>
          </motion.div>
        </motion.div>

        {/* Illustration */}
        <Illustration />
      </section>

      {/* ── Supporting section ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1240px] px-6 pb-24 pt-16 sm:px-8 lg:pt-24">
        <motion.h2
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: EASE }}
          className="eyebrow text-center"
        >
          Designed for meaningful work
        </motion.h2>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 sm:grid-cols-3">
          {[
            { icon: Compass, title: "For Researchers", line: "Meaningful insight that supports studies and shapes policy." },
            { icon: HeartPulse, title: "For Practitioners", line: "Early understanding that leads to timely, better care." },
            { icon: Building2, title: "For Organizations", line: "Data-driven clarity for stronger, healthier communities." },
          ].map((c, i) => (
            <motion.div
              key={c.title}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, ease: EASE, delay: i * 0.08 }}
            >
              <Card className="group h-full transition-[transform,box-shadow] duration-base ease-out hover:-translate-y-[2px] hover:shadow-md">
                <CardHeader>
                  <span className="grid h-11 w-11 place-items-center rounded-control bg-accent-tint text-primary transition-transform duration-slow ease-out group-hover:scale-105">
                    <c.icon className="h-5 w-5" strokeWidth={1.5} />
                  </span>
                  <CardTitle className="mt-2">{c.title}</CardTitle>
                  <CardDescription>{c.line}</CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 px-6 py-8 t-caption text-muted-foreground sm:flex-row sm:px-8">
          <div className="flex items-center gap-2">
            <BrandMark className="h-4 w-4" />
            <span>© 2025 Jeevana Insight · Government of Andhra Pradesh</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════
   Abstract illustration — an intersecting-circles "insight" motif resting
   on soft concentric rings, orbited by floating research cards. One indigo
   family throughout (primary + accent-lavender), never a rainbow.
   ══════════════════════════════════════════════════════════════════════ */

function FloatCard({
  children,
  className = "",
  delay = 0,
  amount = 10,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE, delay }}
      className={`absolute ${className}`}
    >
      <motion.div
        animate={reduce ? undefined : { y: [0, -amount, 0] }}
        transition={reduce ? undefined : { duration: 5.5 + delay, repeat: Infinity, ease: "easeInOut", delay }}
        className="rounded-field border border-border bg-card p-3 shadow-md"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Illustration() {
  const reduce = useReducedMotion();
  const float = (amount: number, duration: number) =>
    reduce ? undefined : { y: [0, -amount, 0], transition: { duration, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.15 }}
      aria-hidden
      className="relative mx-auto hidden aspect-square w-full max-w-[560px] lg:block"
    >
      {/* soft floor glow */}
      <div className="absolute inset-x-[12%] bottom-[14%] h-[38%] rounded-pill bg-[radial-gradient(ellipse,hsl(var(--accent-lavender)/0.18),transparent_70%)] blur-md" />

      {/* concentric rings + pedestal */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <radialGradient id="ringFade" cx="50%" cy="46%" r="50%">
            <stop offset="55%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.14" />
          </radialGradient>
        </defs>
        {[150, 118, 86, 54].map((r, i) => (
          <ellipse
            key={r}
            cx="200"
            cy="212"
            rx={r}
            ry={r * 0.42}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeOpacity={0.16 - i * 0.02}
            strokeWidth="1"
          />
        ))}
        <circle cx="200" cy="190" r="150" fill="url(#ringFade)" />
      </svg>

      {/* central intersecting circles — understanding · insight · humanity */}
      <motion.div animate={float(8, 7)} className="absolute left-1/2 top-[38%] h-[168px] w-[168px] -translate-x-1/2 -translate-y-1/2">
        <div className="absolute inset-0 rounded-pill bg-[radial-gradient(circle,hsl(var(--accent-lavender)/0.3),transparent_70%)] blur-xl" />
        <span className="absolute left-[6%] top-[20%] h-[92px] w-[92px] rounded-pill bg-primary opacity-70 mix-blend-multiply" />
        <span className="absolute right-[6%] top-[20%] h-[92px] w-[92px] rounded-pill bg-accent-lavender opacity-70 mix-blend-multiply" />
        <span className="absolute bottom-[6%] left-1/2 h-[92px] w-[92px] -translate-x-1/2 rounded-pill bg-primary opacity-40 mix-blend-multiply" />
      </motion.div>

      {/* connecting nodes */}
      <svg viewBox="0 0 400 400" className="absolute inset-0 h-full w-full" aria-hidden>
        {[
          [70, 96, 150, 150],
          [330, 90, 250, 150],
          [86, 250, 160, 220],
          [326, 262, 250, 216],
        ].map(([x1, y1, x2, y2], i) => (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--primary))" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {[[70, 96], [330, 90], [86, 250], [326, 262], [200, 60]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="3" fill="hsl(var(--primary))" fillOpacity="0.5" />
        ))}
      </svg>

      {/* Floating research cards */}
      <FloatCard className="left-[2%] top-[10%]" delay={0.35} amount={11}>
        <div className="flex items-center gap-3">
          <MiniDonut />
          <div className="space-y-1">
            <span className="block h-1.5 w-16 rounded-pill bg-primary/30" />
            <span className="block h-1.5 w-11 rounded-pill bg-muted-foreground/20" />
            <span className="block h-1.5 w-14 rounded-pill bg-muted-foreground/15" />
          </div>
        </div>
      </FloatCard>

      <FloatCard className="left-[-2%] top-[46%]" delay={0.6} amount={8}>
        <MiniLine />
      </FloatCard>

      <FloatCard className="right-[1%] top-[7%]" delay={0.5} amount={12}>
        <MiniBars />
      </FloatCard>

      <FloatCard className="left-[6%] bottom-[16%]" delay={0.75} amount={9}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-primary/10">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </span>
          <div>
            <div className="t-caption font-semibold leading-none tabular-nums text-foreground">1,248</div>
            <div className="mt-1 t-caption text-tertiary">Responses</div>
          </div>
        </div>
      </FloatCard>

      <FloatCard className="right-[2%] bottom-[22%]" delay={0.9} amount={10}>
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-accent-tint">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="hsl(var(--accent-lavender))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
            </svg>
          </span>
          <div>
            <div className="t-caption font-semibold leading-none tabular-nums text-foreground">84</div>
            <div className="mt-1 t-caption text-tertiary">Reports generated</div>
          </div>
        </div>
      </FloatCard>
    </motion.div>
  );
}

function MiniDonut() {
  return (
    <svg viewBox="0 0 36 36" className="h-10 w-10" aria-hidden>
      <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--bg-sunken))" strokeWidth="4" />
      <circle
        cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--primary))" strokeWidth="4" strokeLinecap="round"
        strokeDasharray="60 88" transform="rotate(-90 18 18)"
      />
      <circle
        cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--accent-lavender))" strokeWidth="4" strokeLinecap="round"
        strokeDasharray="26 88" strokeDashoffset="-62" transform="rotate(-90 18 18)"
      />
    </svg>
  );
}

function MiniBars() {
  const reduce = useReducedMotion();
  const bars = [10, 18, 13, 24, 20, 30, 26];
  return (
    <div className="flex h-14 w-[132px] items-end gap-1">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          initial={reduce ? { height: h } : { height: 0 }}
          animate={{ height: h }}
          transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.5 + i * 0.06 }}
          className="flex-1 rounded-pill"
          style={{ background: i === bars.length - 2 ? "hsl(var(--primary))" : "hsl(var(--accent-lavender))" }}
        />
      ))}
    </div>
  );
}

function MiniLine() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 120 56" className="h-12 w-[128px]" fill="none" aria-hidden>
      <defs>
        <linearGradient id="lineArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d="M2 44 L22 34 L42 38 L62 20 L82 26 L102 10 L118 14 L118 54 L2 54 Z" fill="url(#lineArea)" />
      <motion.path
        d="M2 44 L22 34 L42 38 L62 20 L82 26 L102 10 L118 14"
        stroke="hsl(var(--primary))"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: EASE, delay: reduce ? 0 : 0.6 }}
      />
    </svg>
  );
}
