import { useCallback } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, Lock, BookOpen, LifeBuoy,
  ClipboardList, Library, QrCode, Users, BarChart3, FileText, ScrollText,
  ShieldCheck, KeyRound, Database, Fingerprint, EyeOff,
  FlaskConical, Landmark, Building2, Stethoscope, GraduationCap,
  BadgeCheck, type LucideIcon,
} from "lucide-react";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { HeroWorkflow } from "@/components/landing/HeroWorkflow";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import {
  ScrollProgress, Reveal, RevealHeading, Magnetic, CountInView, Parallax,
  useScrolled, PREMIUM_EASE,
} from "@/components/landing/motion";
import { cn } from "@/lib/utils";

/* ────────────────────────────────────────────────────────────────────────
   PsyDigiHealth — the platform's front door.

   The layout and copy are fixed. This file's job is the *feel*: a product
   portal that reads as expensive software — cinematic reveals, physical
   buttons, cards with weight, an illustration that breathes. Every effect is
   transform/opacity/filter (GPU, 60fps), collapses under reduced-motion, and
   ships parallax/magnetism to desktop only.

   Palette is the supplied system, scoped to `.landing-portal` so the token
   classes below render in it without touching the app's own tokens.
   ──────────────────────────────────────────────────────────────────────── */

const PALETTE = `
  .landing-portal {
    --bg-canvas: 60 5% 98%;        /* #FAFAF9 */
    --background: 60 5% 98%;
    --bg-surface: 0 0% 100%;       /* #FFFFFF */
    --bg-sunken: 60 5% 96%;
    --card: 0 0% 100%;
    --card-foreground: 0 0% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 10%;
    --foreground: 0 0% 10%;        /* #1A1A1A */
    --text-primary: 0 0% 10%;
    --text-secondary: 223 10% 40%; /* #5B6170 */
    --text-tertiary: 223 8% 56%;
    --muted: 60 5% 96%;
    --muted-foreground: 223 10% 40%;
    --border-subtle: 240 22% 94%;  /* #ECECF3 */
    --border-strong: 240 18% 89%;
    --border: 240 22% 94%;
    --input: 240 22% 94%;
    --primary: 245 91% 63%;        /* #5B4CF7 */
    --primary-hover: 246 84% 57%;
    --primary-active: 246 74% 50%;
    --primary-foreground: 0 0% 100%;
    --primary-tint: 245 100% 97%;
    --accent: 245 100% 97%;
    --accent-foreground: 245 91% 63%;
    --secondary: 60 5% 96%;
    --secondary-foreground: 0 0% 10%;
    --success: 151 82% 34%;        /* #0F9D58 */
    --warning: 28 80% 52%;         /* #E67E22 */
    --danger: 4 71% 50%;           /* #D93025 */
    --destructive: 4 71% 50%;
    --ring: 245 91% 63%;
    --focus-ring: 245 91% 63%;
  }
`;

/* Card hover choreography — one shared voice. Shadow grows, border brightens,
   the card lifts 6px; the icon scales, tilts and saturates. All transform/
   filter, all on the premium curve. */
// No permanent will-change: these cards are static at rest and only transform
// on hover, so promoting all ~24 to their own layers for the page's lifetime
// would waste compositor memory. The browser promotes them fine on hover-intent.
const CARD =
  "group rounded-2xl border border-border bg-canvas transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-[0_1px_2px_rgba(20,20,25,0.04),0_20px_44px_-22px_rgba(91,76,247,0.24)]";
const CARD_ICON =
  "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08] group-hover:rotate-[3deg]";
const CARD_LIFT = "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5";

/* ── Content (real platform data) ───────────────────────────────────────── */

const WORKFLOW = [
  { icon: ClipboardList, title: "Create assessment", line: "Build questionnaires from validated instruments." },
  { icon: QrCode, title: "Generate QR", line: "Publish a secure QR code and shareable link." },
  { icon: Users, title: "Family responds", line: "Answered in English or Telugu, with no login." },
  { icon: Database, title: "Responses stored", line: "Structured answers recorded securely." },
  { icon: BarChart3, title: "Analytics", line: "Trends and per-question breakdowns, live." },
  { icon: FileText, title: "Research reports", line: "Printable reports and exportable datasets." },
];

/**
 * The six modules a visitor can actually be sold on, and no more.
 *
 * Notifications, audit logs, the export centre and the response explorer are
 * real and shipped, but they are back-office plumbing: advertising them on a
 * public page describes an admin console to someone who will never see one, and
 * pads a grid that reads better as a clean 3x2 than as ten cells and an
 * "and more" filler cell.
 */
const FEATURES: { icon: LucideIcon; title: string; line: string }[] = [
  { icon: ClipboardList, title: "Survey Builder", line: "Design structured questionnaires from validated research instruments." },
  { icon: Library, title: "Research Instruments", line: "Eight peer-reviewed scales, reproduced with their original response anchors." },
  { icon: Users, title: "Family Assessment", line: "A guided, bilingual assessment experience that needs no login." },
  { icon: QrCode, title: "QR Distribution", line: "A secure QR code and shareable link for every published survey." },
  { icon: BarChart3, title: "Analytics", line: "Trends, completion and per-question findings, live." },
  { icon: FileText, title: "Reports", line: "Printable, period-over-period research reports." },
];

const INSTRUMENTS = [
  { code: "WHO-5", name: "WHO Well-Being Index", n: 5, desc: "Subjective well-being over the past two weeks." },
  { code: "IRI", name: "Interpersonal Reactivity Index", n: 28, desc: "Multidimensional empathy across four subscales." },
  { code: "BDI", name: "Beck Depression Inventory", n: 21, desc: "Grouped statements on depressive symptoms." },
  { code: "PID-5-BF", name: "Personality Inventory for DSM-5 (Brief)", n: 25, desc: "Screen across five personality trait domains." },
  { code: "CIUS", name: "Compulsive Internet Use Scale", n: 14, desc: "Problematic internet use for private purposes." },
  { code: "STAXI", name: "Trait Anger Scale", n: 10, desc: "Disposition toward experiencing anger." },
  { code: "IMP", name: "Eysenck Impulsiveness Scale", n: 24, desc: "Yes/no measure of impulsiveness." },
  { code: "BHS", name: "Hopelessness (single item)", n: 1, desc: "Single true/false item on future outlook." },
];

const SECURITY: { icon: LucideIcon; title: string; line: string }[] = [
  { icon: KeyRound, title: "Role-Based Access", line: "Only authorised administrators reach the console." },
  { icon: Database, title: "Encrypted Storage", line: "Responses are stored securely, with row-level protection." },
  { icon: ScrollText, title: "Audit Trails", line: "Every administrative action is recorded immutably." },
  { icon: Fingerprint, title: "Secure Authentication", line: "Session-based sign-in; public sign-up is disabled." },
  { icon: EyeOff, title: "Institutional Privacy", line: "Respondents need no login or personal identifiers." },
];

const SECTORS: { icon: LucideIcon; label: string }[] = [
  { icon: FlaskConical, label: "Research" },
  { icon: Landmark, label: "Public Institutions" },
  { icon: Building2, label: "Public Sector" },
  { icon: Stethoscope, label: "Healthcare" },
  { icon: GraduationCap, label: "Academic Organizations" },
];

/* ── Primitives ─────────────────────────────────────────────────────────── */

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow text-primary">{children}</div>;
}

/** A CTA with weight: magnetic pull toward the cursor, a 3px lift and 1.02
 *  scale on hover, a 0.98 press, and an arrow that slides 6px. */
function Cta({
  variant = "default", to, href, onClick, children,
}: {
  variant?: "default" | "secondary";
  to?: string;
  href?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const shadow =
    variant === "default"
      ? "hover:shadow-[0_10px_30px_-8px_rgba(91,76,247,0.5)]"
      : "hover:shadow-[0_10px_28px_-12px_rgba(20,20,25,0.25)]";
  const btn = (
    <Button asChild size="lg" variant={variant} className={cn("group rounded-xl transition-shadow duration-300", shadow)}>
      {to ? <Link to={to}>{children}</Link> : <a href={href} onClick={onClick}>{children}</a>}
    </Button>
  );
  if (reduce) return btn;
  return (
    <Magnetic strength={6}>
      <motion.span
        className="inline-block"
        whileHover={{ y: -3, scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 17 }}
      >
        {btn}
      </motion.span>
    </Magnetic>
  );
}

const Arrow = () => (
  <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-1.5" strokeWidth={1.8} />
);

/* ── Page ───────────────────────────────────────────────────────────────── */

export default function Landing() {
  const reduce = useReducedMotion();
  const scrolled = useScrolled(8);

  const scrollTo = useCallback((id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [reduce]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: PREMIUM_EASE }}
      className="landing-portal min-h-dvh bg-canvas text-foreground"
    >
      <style>{PALETTE}</style>
      <ScrollProgress />

      {/* ── Navigation — transparent at rest, frosts on scroll ─────────── */}
      <header
        className={cn(
          "sticky top-0 z-40 transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300",
          scrolled
            ? "border-b border-border bg-canvas/85 shadow-[0_1px_0_rgba(20,20,25,0.03),0_10px_30px_-24px_rgba(20,20,25,0.3)] backdrop-blur-xl"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
          <Link to="/" className={cn("flex min-w-0 items-center gap-2.5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]", scrolled && "scale-[0.97]")}>
            <Logo size={40} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate t-caption font-semibold tracking-tight">PsyDigiHealth</span>
              <span className="hidden text-[11px] text-muted-foreground sm:block">Family Assessment Research Platform</span>
            </span>
          </Link>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            {[
              { label: "Platform", id: "overview", icon: null as LucideIcon | null },
              { label: "Documentation", id: "capabilities", icon: BookOpen },
              { label: "Support", id: "footer", icon: LifeBuoy },
            ].map((l) => (
              <a
                key={l.label}
                href={`#${l.id}`}
                onClick={scrollTo(l.id)}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 t-caption font-medium text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground"
              >
                {l.icon && <l.icon className="h-3.5 w-3.5" strokeWidth={1.8} />} {l.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-2 md:ml-3">
            {/* Below sm the footer's language switch stands in, so the brand
                name keeps its room instead of truncating to "J…". */}
            <span className="hidden sm:block"><LangToggle size="sm" /></span>
            <Cta to="/auth">Sign In <Arrow /></Cta>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 pb-16 pt-12 sm:px-6 sm:pb-24 lg:px-8 lg:pt-20">
        {/* grid-cols-1 → minmax(0,1fr); without it the fluid headline's
            max-content forces the track wider than a 375–414px viewport. */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-16">
          <div className="min-w-0">
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: PREMIUM_EASE }}
              className="inline-flex max-w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 t-caption font-medium text-muted-foreground"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
              <span className="hidden min-w-0 sm:inline">Private research platform · Access by invitation</span>
              <span className="min-w-0 sm:hidden">Private · Invitation only</span>
            </motion.div>

            <RevealHeading
              as="h1"
              immediate
              lines={["Family Assessment", "Research Platform"]}
              className="t-display mt-6 font-semibold tracking-tight"
            />

            <motion.p
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: PREMIUM_EASE, delay: 0.24 }}
              className="mt-6 max-w-xl t-body text-muted-foreground"
            >
              A secure digital platform for creating validated assessments, distributing questionnaires through QR
              codes, collecting structured responses, and generating research insights.
            </motion.p>

            <motion.p
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: PREMIUM_EASE, delay: 0.3 }}
              className="mt-3 max-w-xl t-caption text-muted-foreground"
            >
              Built for authorised researchers, institutions and public sector organisations to conduct structured
              family assessments using validated research instruments.
            </motion.p>

            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: PREMIUM_EASE, delay: 0.36 }}
              className="mt-8 flex flex-col gap-3 sm:flex-row"
            >
              <Cta to="/auth"><Lock className="h-[18px] w-[18px]" strokeWidth={1.8} /> Sign In</Cta>
              <Cta variant="secondary" href="#overview" onClick={scrollTo("overview")}>View Platform Overview <Arrow /></Cta>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, ease: PREMIUM_EASE, delay: 0.5 }}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 t-caption text-muted-foreground"
            >
              <span className="inline-flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-primary" strokeWidth={1.8} /> <CountInView value={8} /> validated instruments</span>
              <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" strokeWidth={1.8} /> Role-based &amp; audited</span>
              <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" strokeWidth={1.8} /> Bilingual · English &amp; Telugu</span>
            </motion.div>
          </div>

          {/* The illustration breathes and reacts to the cursor; parallax on the
              whole panel is desktop-only and off under reduced-motion. */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: PREMIUM_EASE, delay: 0.2 }}
            className="min-w-0"
          >
            <Parallax distance={12}>
              <HeroWorkflow />
            </Parallax>
          </motion.div>
        </div>
      </section>

      {/* ── Workflow strip ─────────────────────────────────────────────── */}
      <section id="overview" className="scroll-mt-20 border-y border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Reveal className="max-w-2xl">
            <SectionEyebrow>How it works</SectionEyebrow>
            <RevealHeading lines={["From assessment to insight, end to end"]} className="mt-3 t-title font-semibold tracking-tight" />
            <p className="mt-3 t-body text-muted-foreground">
              One connected pipeline. Each stage is a working part of the platform, not a promise.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {WORKFLOW.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.06}>
                <div className={cn(CARD, "relative flex h-full flex-col p-4")}>
                  {i < WORKFLOW.length - 1 && (
                    <span aria-hidden className="absolute -right-3 top-9 z-10 hidden text-border-strong lg:block">
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-primary">
                      <step.icon className={cn("h-[18px] w-[18px]", CARD_ICON)} strokeWidth={1.8} />
                    </span>
                    <span className="text-[11px] font-semibold tabular-nums text-tertiary">{String(i + 1).padStart(2, "0")}</span>
                  </div>
                  <div className={cn("mt-3", CARD_LIFT)}>
                    <div className="t-card font-semibold leading-snug">{step.title}</div>
                    <div className="mt-1 t-caption text-muted-foreground">{step.line}</div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ───────────────────────────────────────────────── */}
      <section id="capabilities" className="mx-auto max-w-[1200px] scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          <SectionEyebrow>Capabilities</SectionEyebrow>
          <RevealHeading lines={["Everything a research programme needs"]} className="mt-3 t-title font-semibold tracking-tight" />
          <p className="mt-3 t-body text-muted-foreground">
            Six working modules cover the full lifecycle — authoring, distribution, collection, analysis and reporting.
          </p>
        </Reveal>

        <Reveal delay={0.05} className="mt-12">
          <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-border bg-card sm:grid-cols-2 lg:grid-cols-3">
            {/*
              Interior hairlines only. The container already draws the outer
              frame, so a cell in the last column or last row must NOT draw its
              own — otherwise it doubles up against the frame. `nth-last-child`
              finds the last row at each breakpoint without hardcoding the count,
              so the grid stays correct if a module is ever added or removed.
            */}
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className={cn(
                  "group border-b border-r border-border p-6 transition-colors duration-300 hover:bg-muted/40 sm:p-8",
                  "border-r-0 last:border-b-0 sm:border-r",
                  "sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-last-child(-n+2)]:border-b-0",
                  "lg:[&:nth-child(2n)]:border-r lg:[&:nth-child(3n)]:border-r-0 lg:[&:nth-last-child(-n+3)]:border-b-0",
                )}
              >
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-canvas text-primary">
                  <f.icon className={cn("h-5 w-5", CARD_ICON)} strokeWidth={1.7} />
                </span>
                <div className={CARD_LIFT}>
                  <h3 className="mt-4 t-card font-semibold">{f.title}</h3>
                  <p className="mt-1.5 t-caption leading-relaxed text-muted-foreground">{f.line}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ── Validated instruments ──────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <Reveal className="max-w-2xl">
            <SectionEyebrow>Validated instruments</SectionEyebrow>
            <RevealHeading lines={["Built on established research scales"]} className="mt-3 t-title font-semibold tracking-tight" />
            <p className="mt-3 t-body text-muted-foreground">
              Eight peer-reviewed instruments are reproduced exactly — each with its original response scale — so
              results remain comparable to published norms.
            </p>
          </Reveal>

          <div className="mt-12 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {INSTRUMENTS.map((ins, i) => (
              <Reveal key={ins.code} delay={(i % 4) * 0.06}>
                <div className={cn(CARD, "flex h-full flex-col p-5")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-card font-semibold tracking-tight">{ins.code}</span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                      <BadgeCheck className="h-3 w-3" strokeWidth={2} /> Validated
                    </span>
                  </div>
                  <div className="mt-1 t-caption font-medium text-foreground/80">{ins.name}</div>
                  <p className="mt-2 flex-1 t-caption leading-relaxed text-muted-foreground">{ins.desc}</p>
                  <div className="mt-4 border-t border-border pt-3 t-caption text-muted-foreground">
                    <CountInView value={ins.n} className="font-semibold tabular-nums text-foreground" /> {ins.n === 1 ? "item" : "items"}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Product showcase ───────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="max-w-2xl">
          <SectionEyebrow>Inside the console</SectionEyebrow>
          <RevealHeading lines={["A clear, purposeful interface"]} className="mt-3 t-title font-semibold tracking-tight" />
          <p className="mt-3 t-body text-muted-foreground">
            Representative views of the actual product surfaces — the same layout and controls administrators use every day.
          </p>
        </Reveal>
        <Reveal delay={0.05} className="mt-10">
          <ProductShowcase />
        </Reveal>
      </section>

      {/* ── Security ───────────────────────────────────────────────────── */}
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <Reveal>
              <SectionEyebrow>Security &amp; trust</SectionEyebrow>
              <RevealHeading lines={["Trusted with sensitive research"]} className="mt-3 t-title font-semibold tracking-tight" />
              <p className="mt-3 t-body text-muted-foreground">
                The platform is built for the standards research institutions require — controlled access, an immutable
                record of every action, and privacy by default for the families who respond.
              </p>
              <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-border bg-canvas px-4 py-3 t-caption text-muted-foreground">
                <ShieldCheck className="h-5 w-5 text-primary" strokeWidth={1.7} />
                Single super-admin account · public sign-up disabled
              </div>
            </Reveal>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {SECURITY.map((s, i) => (
                <Reveal key={s.title} delay={(i % 2) * 0.06}>
                  <div className={cn(CARD, "h-full p-5")}>
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-primary">
                      <s.icon className={cn("h-[18px] w-[18px]", CARD_ICON)} strokeWidth={1.7} />
                    </span>
                    <div className={CARD_LIFT}>
                      <h3 className="mt-3 t-card font-semibold">{s.title}</h3>
                      <p className="mt-1 t-caption leading-relaxed text-muted-foreground">{s.line}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust / built for ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <Reveal className="text-center">
          <SectionEyebrow>Built for</SectionEyebrow>
          <RevealHeading lines={["Serving research and public institutions"]} className="mx-auto mt-3 max-w-2xl t-title font-semibold tracking-tight" />
        </Reveal>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {SECTORS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.06}>
              <div className={cn(CARD, "flex flex-col items-center gap-3 px-4 py-8 text-center")}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
                  <s.icon className={cn("h-6 w-6", CARD_ICON)} strokeWidth={1.6} />
                </span>
                <span className="t-caption font-semibold">{s.label}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer id="footer" className="scroll-mt-20 border-t border-border bg-card">
        <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-sm">
              <div className="flex items-center gap-2.5">
                <Logo size={36} />
                <span className="t-card font-semibold tracking-tight">PsyDigiHealth</span>
              </div>
              <p className="mt-3 t-caption leading-relaxed text-muted-foreground">
                A secure family-assessment research platform for authorised research teams and
                institutions.
              </p>
            </div>

            <nav className="flex flex-wrap gap-x-8 gap-y-3">
              {["Documentation", "Privacy", "Terms", "Support", "Accessibility"].map((l) => (
                <a
                  key={l}
                  href="#footer"
                  onClick={scrollTo("footer")}
                  className="t-caption font-medium text-muted-foreground transition-colors duration-200 hover:text-foreground"
                >
                  {l}
                </a>
              ))}
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
            <div className="t-caption text-muted-foreground">© 2026 PsyDigiHealth · Family Assessment Research Platform</div>
            <div className="flex items-center gap-4">
              <span className="t-caption text-tertiary">v1.0</span>
              <LangToggle size="sm" />
            </div>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
