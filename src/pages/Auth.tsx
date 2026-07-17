import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle, UserRound } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/LangToggle";
import { BrandMark } from "@/components/BrandMark";
import { toast } from "sonner";
// Responsive WebP set + a PNG fallback, all generated from the 1.4MB source by
// `node scripts/optimize-images.mjs`. The source is a soft flat-shaded render,
// so it survives WebP at 5–17KB — a phone was previously downloading the full
// 1.4MB PNG for an illustration that `hidden lg:flex` never even showed it.
import authWebp640 from "@/assets/auth-illustration-640.webp";
import authWebp1024 from "@/assets/auth-illustration-1024.webp";
import authWebp1536 from "@/assets/auth-illustration-1536.webp";
import authFallback from "@/assets/auth-illustration-fallback.png";

/* ────────────────────────────────────────────────────────────────────────
   Jeevana Insight — Sign in
   The quietest, most crafted surface in the product. A calm editorial left,
   a single luminous login card on the right. Every value comes from tokens.
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.33, 1, 0.68, 1] as const; // --ease-out
const emailSchema = z.string().trim().email();

function describeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed"))
    return 'This account’s email hasn’t been confirmed. In Supabase, turn off "Confirm email" under Authentication → Providers → Email, or confirm the user manually, then try again.';
  if (m.includes("invalid login credentials"))
    return "No account matches that email and password. Double-check the email is exactly right and the user exists in Supabase Authentication → Users.";
  if (m.includes("user not found")) return "No account with that email exists yet.";
  return message;
}

export default function Auth() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) nav("/app", { replace: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) nav("/app", { replace: true });
    });
    return () => sub.subscription.unsubscribe();
  }, [nav]);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email"));
    const password = String(fd.get("password"));
    if (!emailSchema.safeParse(email).success) return setError("Enter a valid email address.");
    if (password.length < 1) return setError("Enter your password.");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(describeAuthError(error.message));
    toast.success("Welcome back");
  }

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.07, delayChildren: reduce ? 0 : 0.08 } },
  };
  const item: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-canvas text-foreground">
      {/* Almost-invisible grain so the warm white never reads flat */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.025] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Floating language switcher — minimal, top-right. Sits above the mobile
          banner, so it needs the banner's own stacking context to stay tappable. */}
      <div className="absolute right-4 top-4 z-30 sm:right-8 sm:top-8">
        <LangToggle />
      </div>

      <div className="relative z-10 grid min-h-dvh lg:grid-cols-[2.9fr_minmax(460px,1.1fr)]">
        {/* ══ LEFT on desktop · a banner ABOVE the form on mobile ════════════
            One element, two treatments: a fixed-height illustrated banner on
            phones and the full editorial panel from 1024px. The alternative —
            a second mobile-only <img> — would ship duplicate DOM and a second
            download for the same artwork. */}
        <aside className="relative flex h-40 flex-col justify-between overflow-hidden border-b border-border bg-canvas xs:h-48 sm:h-60 lg:h-auto lg:border-b-0 lg:border-r lg:p-12 xl:p-16">
          {/* Illustration — fills the entire panel, edge to edge */}
          <picture>
            <source
              type="image/webp"
              srcSet={`${authWebp640} 640w, ${authWebp1024} 1024w, ${authWebp1536} 1536w`}
              sizes="(min-width: 1024px) 66vw, 100vw"
            />
            <img
              src={authFallback}
              alt=""
              aria-hidden
              draggable={false}
              width={1536}
              height={1024}
              decoding="async"
              className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover object-center"
            />
          </picture>
          {/* Legibility scrim — keeps the headline crisp over the artwork */}
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-canvas/80 via-canvas/10 to-canvas/45" />

          {/* Top group — brand + editorial headline, over the artwork */}
          <div className="relative z-10 p-5 sm:p-6 lg:p-0">
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="flex items-center gap-3"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-surface shadow-sm ring-1 ring-border">
                <BrandMark className="h-6 w-6" />
              </span>
              <div className="min-w-0 leading-tight">
                <span className="block truncate t-body font-semibold tracking-tight">Jeevana Insight</span>
                <span className="block truncate t-caption text-muted-foreground">Family Assessment Platform</span>
              </div>
            </motion.div>

            {/* The editorial headline is a desktop luxury — on a 160px banner it
                would fight the artwork and shove the form below the fold. */}
            <motion.div initial="hidden" animate="show" variants={container} className="mt-10 hidden max-w-[30rem] lg:block">
              <motion.p variants={item} className="eyebrow text-primary">
                Private workspace
              </motion.p>
              <motion.h1 variants={item} className="font-editorial t-hero mt-6 font-normal">
                Every response
                <br />
                tells <span className="italic text-primary">a story.</span>
              </motion.h1>
              <motion.p variants={item} className="mt-6 max-w-[26rem] t-body text-foreground/70">
                A secure, intelligent platform to create, publish and analyse family
                assessment surveys. Your data stays private. Your insights create impact.
              </motion.p>
            </motion.div>
          </div>

          {/* Trust line */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
            className="relative z-10 hidden items-center gap-2 t-caption text-muted-foreground lg:flex"
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-pill bg-primary/60" />
            Private
            <span className="text-border-strong">·</span>
            Secure
            <span className="text-border-strong">·</span>
            Trusted
            <span className="ml-1 text-tertiary">— authorized access only</span>
          </motion.div>
        </aside>

        {/* ══ RIGHT · the sign-in card ═══════════════════════════════════════ */}
        <main className="relative flex items-start justify-center px-4 py-8 sm:px-6 sm:py-12 lg:items-center lg:py-16">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="w-full max-w-[24rem]"
          >
            {/* The card — a premium, illuminated white surface (the anchor).
                Flush to the 16px gutter at 320px; the old fixed p-6 left just
                224px of usable field width there. */}
            <div className="relative rounded-surface border border-border bg-card p-5 shadow-[var(--highlight-top),var(--shadow-float)] xs:p-6">
              <div className="flex flex-col items-center text-center">
                <span className="grid h-14 w-14 place-items-center rounded-pill bg-accent-tint text-primary ring-1 ring-primary/10">
                  <UserRound className="h-6 w-6" strokeWidth={1.5} />
                </span>
                <h2 className="t-section mt-4 sm:mt-6">Welcome back</h2>
                <p className="mt-2 t-caption text-muted-foreground">
                  Sign in to continue to your secure workspace
                </p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2 rounded-field border border-danger/25 bg-[hsl(var(--danger)/0.06)] p-3.5 t-caption leading-relaxed text-danger sm:mt-6 sm:p-4"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 break-words">{error}</div>
                </div>
              )}

              <form onSubmit={signIn} className="mt-6 space-y-4 sm:mt-8" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="si-email" className="t-caption font-medium text-foreground/80">
                    Email address
                  </Label>
                  <div className="group relative">
                    <Mail aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tertiary transition-colors group-focus-within:text-primary" />
                    <Input
                      id="si-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="admin@example.com"
                      required
                      aria-invalid={!!error}
                      className="h-12 pl-11"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="si-password" className="t-caption font-medium text-foreground/80">
                    Password
                  </Label>
                  <div className="group relative">
                    <Lock aria-hidden className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tertiary transition-colors group-focus-within:text-primary" />
                    <Input
                      id="si-password"
                      name="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      aria-invalid={!!error}
                      className="h-12 pl-11 pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      // touch-halo rather than a bigger box: nothing sits beside
                      // it to steal taps from, and growing it would crowd the
                      // field's right padding on desktop.
                      className="touch-halo absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-pill text-tertiary transition-colors hover:bg-sunken hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)]"
                    >
                      {showPw ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="group h-12 w-full shadow-[var(--highlight-top),var(--shadow-md)] transition-[transform,box-shadow,background-color] duration-base ease-out hover:-translate-y-px hover:shadow-[var(--highlight-top),var(--shadow-float)] active:translate-y-0"
                >
                  {loading ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-[18px] w-[18px] transition-transform duration-base ease-out group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 t-caption text-muted-foreground">
              <Lock className="h-3.5 w-3.5 opacity-70" />
              Private workspace for authorized administrators
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
