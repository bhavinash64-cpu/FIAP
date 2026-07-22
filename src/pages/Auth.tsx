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
import { useT, type Translator } from "@/lib/i18n";
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

/**
 * Takes the translator so the message a signed-out administrator reads is in
 * the language they picked. Supabase's own error strings are English-only and
 * are matched on, never shown — no backend or provider detail is exposed.
 */
function describeAuthError(message: string, t: Translator): string {
  const m = message.toLowerCase();
  if (m.includes("email not confirmed")) return t("authErrUnconfirmed");
  // One message for both a wrong password and a non-existent account — telling
  // them apart would let an attacker enumerate which emails are registered.
  if (m.includes("invalid login credentials") || m.includes("user not found")) return t("authErrInvalid");
  return t("authErrGeneric");
}

export default function Auth() {
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const t = useT();
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
    if (!emailSchema.safeParse(email).success) return setError(t("authInvalidEmail"));
    if (password.length < 1) return setError(t("authEnterPassword"));

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(describeAuthError(error.message, t));
    toast.success(t("authWelcomeBack"));
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

      {/* Column split: three parts visual to one part form.
          The 440px floor on the form column is what keeps that ratio honest —
          a literal 1fr would hand the card 360px at 1440px wide, and once the
          horizontal padding comes off, a 296px form is narrower than the phone
          layout it is supposed to be a step up from. So the ratio holds exactly
          at 1760px and above, and below that the decorative column — the half
          with nothing to do — is the one that gives way. */}
      <div className="relative z-10 grid min-h-dvh grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(440px,1fr)]">
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

          {/* Brand lockup — pinned to the top corner, out of the composition. */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative z-10 flex shrink-0 items-center gap-3"
          >
            <Logo size={44} radius={14} />
            <div className="min-w-0 leading-tight">
              <span className="block truncate t-body font-semibold tracking-tight">Jeevana Insight</span>
              <span className="block truncate t-caption text-muted-foreground">Family Assessment Platform</span>
            </div>
          </motion.div>

          {/*
            Headline and sculpture are ONE optically-centred group, not two
            separately-placed things.

            Before, the headline was glued under the brand lockup at the top and
            the sculpture took the leftover height below it — so the sculpture
            centred itself in whatever space happened to remain and read as
            bottom-heavy, while the top-left corner carried all the text. Making
            the pair a single centred stack in the free space between the lockup
            and the trust line is what actually balances the panel, and it stays
            balanced as the viewport height changes because both halves move
            together.
          */}
          <div className="relative z-0 flex min-h-0 flex-1 flex-col items-center justify-center gap-8 overflow-hidden py-8">
            <motion.div
              initial="hidden"
              animate="show"
              variants={container}
              className="w-full max-w-[30rem] shrink-0"
            >
              <motion.p variants={item} className="eyebrow" style={{ color: "#5E43F3" }}>
                {t("authPrivateWorkspace")}
              </motion.p>
              <motion.h1 variants={item} className="font-editorial t-hero mt-5 font-normal leading-[1.08]">
                {t("authHeadlineLine1")}
                <br />
                {t("authHeadlineLine2")}{" "}
                <span className="italic" style={{ color: "#5E43F3" }}>{t("authHeadlineAccent")}</span>
              </motion.h1>
              <motion.p variants={item} className="mt-5 max-w-[26rem] t-body text-foreground/65">
                {t("authLede")}
              </motion.p>
            </motion.div>

            {/*
              The sculpture is a FIXED 560x600 box. Scaling it with a transform
              alone shrank what you see but left the 600px layout box behind, so
              the flex column still reserved 600px, overflowed the locked panel
              height and clipped the lower cards off the bottom of the screen.

              So the wrapper carries the scaled dimensions and the transform runs
              from the top-left corner: layout box and visual box are the same
              rectangle again, which is what lets `items-center` actually centre
              it. The scale is one custom property so both stay in step at every
              breakpoint — change it in one place, never two.
            */}
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, ease: EASE, delay: 0.2 }}
              className="shrink-0 [--illo:0.46] xl:[--illo:0.58] 2xl:[--illo:0.68]"
              style={{
                width: "calc(560px * var(--illo))",
                height: "calc(600px * var(--illo))",
              }}
            >
              <div style={{ transform: "scale(var(--illo))", transformOrigin: "top left" }}>
                <AuthIllustration />
              </div>
            </motion.div>
          </div>

          {/* Trust line (bottom) */}
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE, delay: 0.5 }}
            className="relative z-10 hidden shrink-0 items-center gap-2 t-caption text-muted-foreground lg:flex"
          >
            <span className="inline-flex h-1.5 w-1.5 rounded-pill" style={{ background: "rgba(94,67,243,0.6)" }} />
            {t("authTrustPrivate")}
            <span className="text-border-strong">·</span>
            {t("authTrustSecure")}
            <span className="text-border-strong">·</span>
            {t("authTrustTrusted")}
            <span className="ml-1 text-tertiary">{t("authTrustSuffix")}</span>
          </motion.div>
        </aside>

        {/* ══ RIGHT · the sign-in card ═══════════════════════════════════════ */}
        {/* Below lg the vertical padding is symmetric on purpose: the top band is
            deeper than the floating LangToggle's footprint (top-4 + 36px = 52px,
            sm:top-8 + 36px = 68px) so the compact brand lockup can never collide
            with it even when a short viewport pushes the card up against the top,
            and the matching bottom band keeps the card optically centred. From lg
            the lockup is hidden, so the column can breathe closer to the edges. */}
        {/* Horizontal padding is tighter from lg than it looks like it should be:
            the form column is now the narrow one, so every rem of gutter comes
            straight off the input width. px-8 keeps ~376px of usable card at
            1440px, which is wider than the phone layout — the thing the desktop
            form must never lose to. */}
        <main className="relative flex min-h-dvh w-full min-w-0 flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-12 xl:px-10">
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.1 }}
            className="w-full max-w-[420px]"
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
                <h2 className="t-title mt-6 font-semibold tracking-tight">{t("authWelcomeBack")}</h2>
                <p className="mt-2 t-caption text-muted-foreground">{t("authSignInSubtitle")}</p>
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
                    {t("authEmailLabel")}
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
                      placeholder={t("authEmailPlaceholder")}
                      required
                      aria-invalid={!!error}
                      className="h-[60px] rounded-[18px] border-[rgba(80,80,120,0.10)] bg-white pl-12 hover:border-[rgba(80,80,120,0.18)] focus-visible:border-[#6E5BFF] focus-visible:bg-white focus-visible:ring-[6px] focus-visible:ring-[rgba(110,91,255,0.10)]"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="si-password" className="t-caption font-medium text-foreground/70">
                    {t("authPasswordLabel")}
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
                      placeholder={t("authPasswordPlaceholder")}
                      required
                      aria-invalid={!!error}
                      className="h-[60px] rounded-[18px] border-[rgba(80,80,120,0.10)] bg-white pl-12 pr-12 hover:border-[rgba(80,80,120,0.18)] focus-visible:border-[#6E5BFF] focus-visible:bg-white focus-visible:ring-[6px] focus-visible:ring-[rgba(110,91,255,0.10)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? t("authHidePassword") : t("authShowPassword")}
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
                      {t("continue")}
                      <ArrowRight className="h-[18px] w-[18px] transition-transform duration-base ease-out group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </form>
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 t-caption text-muted-foreground">
              <Lock className="h-3.5 w-3.5 opacity-70" />
              {t("authFooterNote")}
            </p>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
