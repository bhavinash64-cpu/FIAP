import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import { AuthIllustration } from "@/components/auth/AuthIllustration";
import { toast } from "sonner";

/* ────────────────────────────────────────────────────────────────────────
   Jeevana Insight — Sign in
   The quietest, most crafted surface in the product. A calm editorial left
   with a handcrafted floating sculpture, a single luminous login card on the
   right. Bespoke premium values (spacing 4/8/12/16/24/32/48; radii up to 36;
   one purple palette; one soft shadow language).
   ──────────────────────────────────────────────────────────────────────── */

const EASE = [0.33, 1, 0.68, 1] as const;
const emailSchema = z.string().trim().email();

function describeAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed"))
    return "This account hasn't been confirmed yet. Please contact your administrator.";
  // One message for both a wrong password and a non-existent account — telling
  // them apart would let an attacker enumerate which emails are registered. No
  // backend/provider details are exposed either.
  if (m.includes("invalid login credentials") || m.includes("user not found"))
    return "The email or password is incorrect.";
  return "Couldn't sign in right now. Please check your connection and try again.";
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
    <div className="relative min-h-dvh bg-[#FAFAFD] text-foreground">
      {/* The card is vertically centred in the viewport. min-h-dvh (not a hard
          h-dvh clip) means that on a short or zoomed screen the page scrolls
          just enough to keep the whole card reachable, instead of cutting the
          Continue button off — so the cards are always centred AND complete. */}
      {/* Almost-invisible grain so the cool white never reads flat */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.02] mix-blend-soft-light"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Floating language switcher — minimal, top-right. */}
      <div className="absolute right-4 top-4 z-30 sm:right-8 sm:top-8">
        <LangToggle />
      </div>

      {/* Column split: the editorial panel still leads, but only just. The card
          column carries a 520px floor AND a fixed 45% of the free space, so it is
          never the column that gets squeezed: it holds that 45% identically at
          1280, 1440, 1600 and 1920 instead of collapsing toward a narrow rail
          while the illustration keeps growing. Below 1156px the 520px floor takes
          over and the editorial panel — the decorative half — gives way instead. */}
      <div className="relative z-10 grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1.1fr)_minmax(520px,0.9fr)]">
        {/* ══ LEFT · editorial panel + floating sculpture — desktop only ══ */}
        <aside className="relative hidden overflow-hidden bg-[#FAFAFD] lg:flex lg:h-dvh lg:flex-col lg:border-r lg:border-[rgba(94,67,243,0.08)] lg:p-12 xl:p-16">
          {/* Ambient purple wash — the warm light the whole panel sits in */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 80% at 18% 0%, rgba(237,233,254,0.9) 0%, rgba(250,250,253,0) 55%), radial-gradient(90% 90% at 85% 100%, rgba(167,139,250,0.12) 0%, rgba(250,250,253,0) 60%)",
            }}
          />

          {/* Brand + editorial headline (top) */}
          <div className="relative z-10 p-5 sm:p-6 lg:p-0">
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE }}
              className="flex items-center gap-3"
            >
              <Logo size={44} radius={14} />
              <div className="min-w-0 leading-tight">
                <span className="block truncate t-body font-semibold tracking-tight">Jeevana Insight</span>
                <span className="block truncate t-caption text-muted-foreground">Family Assessment Platform</span>
              </div>
            </motion.div>

            <motion.div initial="hidden" animate="show" variants={container} className="mt-12 hidden max-w-[30rem] lg:block">
              <motion.p variants={item} className="eyebrow" style={{ color: "#5E43F3" }}>
                Private workspace
              </motion.p>
              <motion.h1 variants={item} className="font-editorial t-hero mt-6 font-normal leading-[1.08]">
                Every response
                <br />
                tells <span className="italic" style={{ color: "#5E43F3" }}>a story.</span>
              </motion.h1>
              <motion.p variants={item} className="mt-6 max-w-[26rem] t-body text-foreground/65">
                A secure, intelligent platform to create, publish and analyse family
                assessment surveys. Your data stays private. Your insights create impact.
              </motion.p>
            </motion.div>
          </div>

          {/* The handcrafted floating sculpture — desktop only, centred in the
              remaining space. Scaled to fit narrower desktops without cropping. */}
          {/* min-h-0 + overflow-hidden lets this decorative area shrink and clip
              instead of forcing the grid row taller than the locked viewport. */}
          <div className="relative z-0 hidden min-h-0 flex-1 place-items-center overflow-hidden lg:grid">
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
              className="origin-center scale-[0.62] xl:scale-[0.8] 2xl:scale-[0.92]"
            >
              <AuthIllustration />
            </motion.div>
          </div>

          {/* Trust line (bottom) */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
            className="relative z-10 hidden items-center gap-2 t-caption text-muted-foreground lg:flex"
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-pill" style={{ background: "rgba(94,67,243,0.6)" }} />
            Private
            <span className="text-border-strong">·</span>
            Secure
            <span className="text-border-strong">·</span>
            Trusted
            <span className="ml-1 text-tertiary">— authorized access only</span>
          </motion.div>
        </aside>

        {/* ══ RIGHT · the sign-in card ═══════════════════════════════════════ */}
        {/* Below lg the vertical padding is symmetric on purpose: the top band is
            deeper than the floating LangToggle's footprint (top-4 + 36px = 52px,
            sm:top-8 + 36px = 68px) so the compact brand lockup can never collide
            with it even when a short viewport pushes the card up against the top,
            and the matching bottom band keeps the card optically centred. From lg
            the lockup is hidden, so the column can breathe closer to the edges. */}
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-24 lg:px-10 lg:py-12 xl:px-14">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="w-full max-w-[472px]"
          >
            {/* Compact brand — mobile/tablet only, since the banner is gone there. */}
            <div className="mb-4 flex items-center justify-center gap-2.5 sm:mb-6 lg:hidden">
              <Logo size={40} radius={13} />
              <span className="leading-tight">
                <span className="block t-caption font-semibold tracking-tight">Jeevana Insight</span>
                <span className="block text-[11px] text-muted-foreground">Family Assessment Platform</span>
              </span>
            </div>

            {/* A premium macOS-style panel: soft white, a whisper of a purple
                edge, one big soft cast, and a bright inner top highlight. */}
            <div className="relative rounded-[28px] border border-[rgba(94,67,243,0.07)] bg-[rgba(255,255,255,0.94)] p-6 backdrop-blur-[30px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_50px_140px_rgba(95,70,255,0.10),0_2px_10px_rgba(46,42,69,0.04)] sm:rounded-[32px] sm:p-8 lg:rounded-[36px] lg:p-12">
              <div className="flex flex-col items-center text-center">
                <Logo size={52} radius={16} />
                <h2 className="t-title mt-6 font-semibold tracking-tight">Welcome back</h2>
                <p className="mt-2 t-caption text-muted-foreground">Sign in to continue to your secure workspace</p>
              </div>

              {error && (
                <div
                  role="alert"
                  className="mt-6 flex items-start gap-2 rounded-[16px] border border-danger/25 bg-[hsl(var(--danger)/0.06)] p-4 t-caption leading-relaxed text-danger"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 break-words">{error}</div>
                </div>
              )}

              <form onSubmit={signIn} className="mt-6 space-y-5 sm:space-y-6" noValidate>
                <div className="space-y-3">
                  <Label htmlFor="si-email" className="t-caption font-medium text-foreground/70">
                    Email address
                  </Label>
                  <div className="group relative">
                    <Mail
                      aria-hidden
                      className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tertiary transition-colors group-focus-within:text-[#6E5BFF]"
                    />
                    <Input
                      id="si-email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="admin@example.com"
                      required
                      aria-invalid={!!error}
                      className="h-[60px] rounded-[18px] border-[rgba(80,80,120,0.10)] bg-white pl-12 hover:border-[rgba(80,80,120,0.18)] focus-visible:border-[#6E5BFF] focus-visible:bg-white focus-visible:ring-[6px] focus-visible:ring-[rgba(110,91,255,0.10)]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="si-password" className="t-caption font-medium text-foreground/70">
                    Password
                  </Label>
                  <div className="group relative">
                    <Lock
                      aria-hidden
                      className="pointer-events-none absolute left-5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tertiary transition-colors group-focus-within:text-[#6E5BFF]"
                    />
                    <Input
                      id="si-password"
                      name="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      required
                      aria-invalid={!!error}
                      className="h-[60px] rounded-[18px] border-[rgba(80,80,120,0.10)] bg-white pl-12 pr-12 hover:border-[rgba(80,80,120,0.18)] focus-visible:border-[#6E5BFF] focus-visible:bg-white focus-visible:ring-[6px] focus-visible:ring-[rgba(110,91,255,0.10)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      aria-pressed={showPw}
                      className="touch-halo absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-pill text-tertiary transition-colors hover:bg-[rgba(94,67,243,0.06)] hover:text-[#6E5BFF] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[rgba(110,91,255,0.20)]"
                    >
                      {showPw ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="group h-[58px] w-full rounded-[18px] border-0 text-white shadow-[0_20px_60px_rgba(94,67,243,0.30)] transition-[transform,box-shadow] duration-[250ms] ease-out hover:scale-[1.015] hover:shadow-[0_24px_70px_rgba(94,67,243,0.34)] active:scale-100"
                  style={{ background: "linear-gradient(180deg, #7B61FF, #5E43F3)" }}
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
