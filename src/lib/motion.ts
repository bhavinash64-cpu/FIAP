import type { Variants, Transition } from "framer-motion";

/** Shared easing + spring presets so motion feels consistent everywhere. */
export const easeOut = [0.16, 1, 0.3, 1] as const;

export const spring: Transition = { type: "spring", stiffness: 400, damping: 32 };
export const softSpring: Transition = { type: "spring", stiffness: 260, damping: 26 };

/** A single element fading up into place. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: easeOut } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: easeOut } },
};

/** Parent that staggers its children into view. */
export const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.04 } },
};

/** Child used inside a staggerParent. */
export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

/** Gentle idle float loop for hero/decorative elements. */
export const floatLoop = (delay = 0): Transition => ({
  duration: 4.5,
  repeat: Infinity,
  ease: "easeInOut",
  delay,
});
