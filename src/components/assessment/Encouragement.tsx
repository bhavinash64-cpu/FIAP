import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useT } from "@/lib/i18n";

/**
 * A short acknowledgement, twice per assessment, and never again.
 *
 * Two constraints shape this into almost nothing:
 *
 *  - Published surveys are capped at 25 questions. The obvious cadence —
 *    quarter, half, three-quarter, nearly-done — would be a message every four
 *    screens, which is the point at which encouragement stops reading as warmth
 *    and starts reading as a progress bar with opinions.
 *  - The register has to survive the subject matter. "You're doing great!"
 *    after someone reports thinking about killing themselves is grotesque. What
 *    is left is acknowledgement of position, not praise of the person.
 *
 * So: the midpoint, and two from the end. Each moment is spent the first time
 * it is reached and never returns, so paging backwards and forwards does not
 * replay it. That memory lives in a ref, which is why this component must be
 * mounted ABOVE the per-question keyed subtree in QuestionStage — inside it,
 * the remount on every question would wipe the memory.
 */
type Moment = "halfway" | "nearlyDone";

export function Encouragement({ index, total }: { index: number; total: number }) {
  const t = useT();
  const reduce = useReducedMotion();
  /**
   * The moment is held, not the resolved sentence. Two reasons: `useT()` hands
   * back a fresh closure on every render, so keeping the string would mean
   * putting `t` in the dependency array below and re-running the effect on
   * every single render; and holding the key means the line re-resolves when
   * the respondent switches language mid-question instead of freezing in
   * whichever language it was first shown in.
   */
  const [moment, setMoment] = useState<Moment | null>(null);
  /** Which moments have already been spent, so they never repeat. */
  const spent = useRef<Set<Moment>>(new Set());

  useEffect(() => {
    // Under ~6 questions there is no meaningful "halfway" to mark, and the run
    // is over before encouragement could earn its place on the screen.
    if (total < 6) {
      setMoment(null);
      return;
    }

    const halfway = Math.floor(total / 2);
    const nearlyDone = total - 3;

    let next: Moment | null = null;
    if (index === halfway) next = "halfway";
    else if (index === nearlyDone && nearlyDone > halfway) next = "nearlyDone";

    // Visibility is derived from where the respondent is, not from a timer.
    // A timeout was the obvious way to auto-hide this, and it was wrong twice
    // over: navigating away inside the window ran the effect cleanup, which
    // cancelled the hide and left the message pinned to the screen for the rest
    // of the assessment. Tying it to the question instead means leaving the
    // question is what dismisses it, which cannot get stuck and needs no timer.
    if (!next || spent.current.has(next)) {
      setMoment(null);
      return;
    }
    spent.current.add(next);
    setMoment(next);
  }, [index, total]);

  const message = moment ? t(moment === "halfway" ? "encourageHalfway" : "encourageNearlyDone") : null;

  // Reserving no space when idle is deliberate: the message sits above the
  // prompt, and a permanently reserved 24px band would push the question down
  // on every screen to accommodate something shown twice. It animates height so
  // the arrival does not jolt the prompt.
  return (
    <motion.div
      initial={false}
      animate={{ height: message ? "auto" : 0, opacity: message ? 1 : 0 }}
      transition={reduce ? { duration: 0 } : { duration: 0.24, ease: [0.33, 1, 0.68, 1] }}
      className="overflow-hidden"
      aria-hidden={!message}
    >
      {/* polite, not assertive: this must never interrupt narration of the
          question a respondent is in the middle of hearing. */}
      <p className="pb-3 t-caption font-medium text-primary" role="status" aria-live="polite">
        {message}
      </p>
    </motion.div>
  );
}
