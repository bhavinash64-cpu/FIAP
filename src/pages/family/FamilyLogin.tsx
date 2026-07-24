import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowRight, Loader2, Phone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { LangToggle } from "@/components/LangToggle";
import { Logo } from "@/components/Logo";
import {
  FamilyAccessError,
  familyLogin,
  hasRespondentSession,
  resolveFamilyLink,
  type LinkResolution,
} from "@/lib/familyAccess";
import { renderBilingual, translate, useI18nStore, useLangMode, useT, type DictKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The family's door into the platform — the only screen a respondent sees before
 * their assessment, on both `/family` and `/family/:token`.
 *
 * The rule that governs everything here: a grieving family opened this on a
 * phone, often standing up, often once. So the screen asks for exactly two
 * things, never explains the system, never offers a second path, and never
 * makes them re-answer something the officer already recorded. Anything that
 * would read as a product — a split hero, an illustration, a marketing line —
 * is deliberately absent. It should feel like a hospital appointment card.
 */

const EASE = [0.33, 1, 0.68, 1] as const;

/** Accepts what people actually type: +91 98765 43210, 09876543210, 9876543210. */
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

function minutesUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.ceil(ms / 60000);
}

/**
 * A live countdown rather than a static "wait 15 minutes": someone who has
 * already been waiting should not be told to start waiting again.
 */
function useRetryCountdown(retryAt?: string): number | null {
  const [left, setLeft] = useState<number | null>(() => minutesUntil(retryAt));

  useEffect(() => {
    setLeft(minutesUntil(retryAt));
    if (!retryAt) return;
    const id = window.setInterval(() => setLeft(minutesUntil(retryAt)), 1000);
    return () => window.clearInterval(id);
  }, [retryAt]);

  return left;
}

interface LoginFailure {
  key: DictKey;
  retryAt?: string;
}

export default function FamilyLogin() {
  const { token } = useParams<{ token?: string }>();
  const nav = useNavigate();
  const t = useT();
  const mode = useLangMode();
  const reduce = useReducedMotion();

  // Read once. Re-reading on every render would let a mid-session storage write
  // yank the form out from under someone who is already typing.
  const [alreadySignedIn] = useState(hasRespondentSession);

  const [link, setLink] = useState<LinkResolution | null>(null);
  const [resolving, setResolving] = useState(!!token);

  const [phone, setPhone] = useState("");
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<LoginFailure | null>(null);

  const languageApplied = useRef(false);
  const retryMinutes = useRetryCountdown(failure?.retryAt);

  useEffect(() => {
    document.title = `${translate(mode, "familySignInTitle")} · ${translate(mode, "appShort")}`;
  }, [mode]);

  useEffect(() => {
    if (!token || alreadySignedIn) {
      setLink(null);
      setResolving(false);
      return;
    }
    let live = true;
    setResolving(true);
    resolveFamilyLink(token)
      .then((res) => {
        if (!live) return;
        setLink(res);
        // The officer already recorded which language this family reads. Asking
        // them to pick it again is a question we know the answer to. The ref
        // keeps this to the first resolve so it can never fight a manual toggle.
        if (res.state === "ok" && !languageApplied.current) {
          languageApplied.current = true;
          useI18nStore.getState().setMode(res.case.language);
        }
      })
      .catch(() => {
        // A failed resolve is a network problem, not a bad link. Fall through to
        // the plain form — the credentials still work without the token preview.
        if (live) setLink(null);
      })
      .finally(() => {
        if (live) setResolving(false);
      });
    return () => {
      live = false;
    };
  }, [token, alreadySignedIn]);

  const normalised = useMemo(() => normalisePhone(phone), [phone]);
  const phoneValid = INDIAN_MOBILE.test(normalised);
  const phoneError = phoneTouched && !phoneValid;

  const submit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setPhoneTouched(true);
      setFailure(null);
      // Never spend a server attempt — or a lockout slot — on input we can see
      // is malformed from here.
      if (!phoneValid || !token || submitting) return;

      setSubmitting(true);
      try {
        await familyLogin({ phone: normalised, token });
        nav("/family/assessment", { replace: true });
      } catch (err) {
        if (err instanceof FamilyAccessError) {
          switch (err.code) {
            case "invalid_credentials":
              // One message for a wrong link and a wrong phone alike. Telling them
              // apart would turn this form into a way to test phone numbers until
              // one is accepted — i.e. to enumerate which bereaved families are
              // enrolled in the study.
              setFailure({ key: "familyErrInvalid" });
              break;
            case "locked":
              setFailure({ key: "familyErrLocked", retryAt: err.retryAt });
              break;
            case "expired":
              setFailure({ key: "familyErrExpired" });
              break;
            case "too_many_attempts":
              setFailure({ key: "familyErrTooMany" });
              break;
            case "already_submitted":
              setFailure({ key: "familyErrAlreadyDone" });
              break;
            default:
              setFailure({ key: "familyErrNetwork" });
          }
        } else {
          setFailure({ key: "familyErrNetwork" });
        }
      } finally {
        setSubmitting(false);
      }
    },
    [nav, normalised, phoneValid, submitting, token],
  );

  if (alreadySignedIn) return <Navigate to="/family/assessment" replace />;

  // The dead-end title REPLACES the sign-in heading rather than sitting under
  // it: on a broken link the one thing the family needs to read first is why
  // nothing is going to happen here, not the name of the screen. `expired`
  // carries no body because its own sentence already says what to do next, and
  // the help line under the card repeats it.
  const deadEnd: { title: string; body: string | null } | null =
    // No token at all means someone reached /family directly. Since the link IS
    // the credential now, a form here could never succeed — so it is not shown.
    // Rendering a phone field that always returns "incorrect" would read as the
    // family's own mistake, and would also be exactly the enumeration surface
    // this design removes.
    !token
      ? { title: t("familyNeedLinkTitle"), body: t("familyNeedLinkBody") }
      : link && link.state !== "ok"
        ? link.state === "expired"
          ? { title: t("familyErrExpired"), body: null }
          : { title: t("familyErrNotFound"), body: t("familyErrNotFoundBody") }
        : null;

  return (
    <div className="relative min-h-dvh bg-canvas text-foreground">
      {/* One soft wash behind the card so the warm paper never reads as a blank
          sheet. No grain, no sculpture — this page carries no decoration. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 60% at 50% 0%, hsl(var(--primary) / 0.06) 0%, transparent 62%)",
        }}
      />

      <div className="absolute right-4 top-4 z-30 sm:right-6 sm:top-6">
        <LangToggle size="sm" />
      </div>

      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[27rem] flex-col justify-center px-5 py-16 sm:px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
        >
          <div className="card-premium p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <Logo size={52} />
              <h1 className="mt-5 t-title text-balance">{deadEnd ? deadEnd.title : t("familySignInTitle")}</h1>
              {!deadEnd && (
                <p className="mt-2.5 t-body text-balance leading-relaxed text-muted-foreground">
                  {t("familySignInIntro")}
                </p>
              )}
            </div>

            {deadEnd ? (
              <div className="mt-6 text-center">
                {deadEnd.body && (
                  <p className="t-body text-balance leading-relaxed text-muted-foreground">{deadEnd.body}</p>
                )}
                {/* A mistyped or stale URL must stay recoverable — the slip still
                    has the family’s phone number on it. */}
                <Button asChild size="xl" shape="pill" className="mt-7 w-full">
                  <Link to="/family">
                    {t("secureAccessAction")}
                    <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                {(resolving || (link && link.state === "ok")) && (
                  <div className="mt-6 rounded-surface border border-border/70 bg-sunken p-4">
                    {resolving || !link || link.state !== "ok" ? (
                      <div className="space-y-2.5">
                        <Skeleton className="h-4 w-3/5 rounded-pill" />
                        <Skeleton className="h-3.5 w-4/5 rounded-pill" />
                        <Skeleton className="h-3.5 w-2/5 rounded-pill" />
                      </div>
                    ) : (
                      <div className="min-w-0">
                        <div className="truncate t-card">
                          {renderBilingual(mode, link.survey.titleEn, link.survey.titleTe).primary}
                        </div>
                        <p className="mt-1.5 t-body text-muted-foreground">
                          {t("familyForCase", { name: link.case.familyHead })}
                        </p>
                        <p className="mt-0.5 t-caption text-tertiary">
                          {t("familyPhoneEndingIn", { hint: link.case.phoneHint })}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {failure && (
                  <div
                    role="alert"
                    className="mt-6 flex items-start gap-2.5 rounded-surface border border-danger/25 bg-[hsl(var(--danger)/0.06)] p-4 t-caption leading-relaxed text-danger"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                    <div className="min-w-0 break-words">
                      {t(failure.key)}
                      {failure.key === "familyErrLocked" && retryMinutes !== null && (
                        <div className="mt-1 font-semibold tabular-nums">
                          {t("familyErrLockedRetry", { n: retryMinutes })}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
                  <div className="space-y-2.5">
                    <Label htmlFor="family-phone" className="t-caption font-medium text-foreground/70">
                      {t("familyPhoneLabel")}
                    </Label>
                    <div className="group relative">
                      <Phone
                        aria-hidden
                        className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tertiary transition-colors group-focus-within:text-primary"
                        strokeWidth={1.7}
                      />
                      <Input
                        id="family-phone"
                        name="phone"
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel"
                        maxLength={15}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onBlur={() => setPhoneTouched(true)}
                        disabled={submitting}
                        placeholder="98765 43210"
                        aria-invalid={phoneError}
                        aria-describedby="family-phone-help"
                        className={cn(
                          "h-14 pl-11 text-base lg:h-14 lg:text-base",
                          phoneError && "border-danger focus-visible:border-danger",
                        )}
                      />
                    </div>
                    {/* The help line doubles as the error line. A family reading
                        "10-digit mobile number" already knows what went wrong;
                        a second sentence saying so would just be louder. */}
                    <p
                      id="family-phone-help"
                      className={cn("t-caption", phoneError ? "text-danger" : "text-muted-foreground")}
                    >
                      {t("familyPhoneHelp")}
                    </p>
                  </div>


                  <Button
                    type="submit"
                    size="xl"
                    shape="pill"
                    disabled={submitting}
                    className="w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        {t("familyCheckingIn")}
                      </>
                    ) : (
                      <>
                        {t("familyContinue")}
                        <ArrowRight className="h-[18px] w-[18px]" strokeWidth={1.8} />
                      </>
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>

          {/* Losing the slip must never be a dead end, so the way out is on the
              screen before anyone has failed at it. */}
          <p className="mx-auto mt-6 flex max-w-[24rem] items-start justify-center gap-2 t-caption leading-relaxed text-muted-foreground">
            <ShieldCheck className="mt-px h-[15px] w-[15px] shrink-0 opacity-70" strokeWidth={1.7} />
            <span className="text-balance">{t("familyNeedHelp")}</span>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
