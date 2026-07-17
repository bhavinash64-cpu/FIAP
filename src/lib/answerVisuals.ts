import type { SurveyQuestion } from "@/lib/surveys";

/**
 * The visual layer over validated response scales.
 *
 * Rule that governs everything here: the glyph may restate the option's
 * POSITION on its scale, never a judgement about the answer. That distinction
 * decides which scales get faces.
 *
 *  - Agreement scales (strongly disagree → strongly agree) get the face ramp.
 *    A respondent reads that ramp as "how much do I assent", which is exactly
 *    what the scale asks, so the faces restate the anchors rather than colour
 *    them.
 *  - Frequency ("never → very often"), truth ("very false → very true") and
 *    description ("does not describe me → describes me very well") scales get a
 *    neutral step meter instead. Faces would editorialise: on a CIUS item like
 *    "how often are you short of sleep because of the internet", 😊 against
 *    "Never" turns a frequency report into praise, which changes what the
 *    instrument measures.
 *  - Anything not recognised as ordinal (a city list, BDI's grouped statements)
 *    gets no ramp at all. Inventing an order for unordered options would be the
 *    same error in the other direction.
 *
 * Scoring is untouched everywhere: option order, ids and stored values are
 * exactly what the instrument defines.
 */

export type ScaleShape =
  | "agreement"
  /** never → always */
  | "frequency"
  /** very false → very true */
  | "truth"
  /** does not describe me → describes me very well */
  | "description"
  /** recognised as ordered, no known semantic */
  | "intensity"
  | "binary"
  /** not ordinal — render plainly */
  | "none";

export interface OptionVisual {
  emoji?: string;
  /** 1-based step on an ordered meter of `total` steps. */
  level?: number;
  total?: number;
}

/** Ascending assent. Matches the 5-point agree/disagree anchors exactly. */
const FACES_5 = ["😢", "🙁", "😐", "🙂", "😊"];
const FACES_4 = ["😢", "🙁", "🙂", "😊"];
const FACES_3 = ["🙁", "😐", "🙂"];

const AGREEMENT_RE = /\b(agree|disagree)\b/i;
const FREQUENCY_RE = /\b(never|seldom|rarely|sometimes|often|always|at no time|all of the time|most of the time|half the time|some of the time)\b/i;
const TRUTH_RE = /\b(true|false)\b/i;
const DESCRIPTION_RE = /describes? me/i;

/**
 * Classify by the ENGLISH anchors: `label_en` is always authored, whereas
 * `label_te` may be absent, so English keeps the classification stable in both
 * language modes. A scale must match on at least two anchors — a single stray
 * "true" inside one option of an unrelated list is not a truth scale.
 */
export function classifyScale(labelsEn: string[]): ScaleShape {
  const n = labelsEn.length;
  if (n < 2) return "none";

  const hits = (re: RegExp) => labelsEn.filter((l) => re.test(l)).length;

  if (n === 2) {
    const joined = labelsEn.join(" ").toLowerCase();
    if (/\byes\b/.test(joined) && /\bno\b/.test(joined)) return "binary";
    if (hits(TRUTH_RE) === 2) return "truth";
    return "none";
  }

  if (n > 7) return "none";
  if (hits(AGREEMENT_RE) >= 2) return "agreement";
  if (hits(DESCRIPTION_RE) >= 2) return "description";
  if (hits(FREQUENCY_RE) >= 2) return "frequency";
  if (hits(TRUTH_RE) >= 2) return "truth";
  return "none";
}

/** Visuals for an ordered scale of `count` options, index 0 first. */
export function visualsForShape(shape: ScaleShape, count: number): OptionVisual[] {
  const blank = () => Array.from({ length: count }, () => ({}) as OptionVisual);

  switch (shape) {
    case "agreement": {
      const faces = count === 5 ? FACES_5 : count === 4 ? FACES_4 : count === 3 ? FACES_3 : null;
      if (!faces) return rampVisuals(count);
      return faces.map((emoji, i) => ({ emoji, level: i + 1, total: count }));
    }
    case "frequency":
    case "truth":
    case "description":
    case "intensity":
      return rampVisuals(count);
    case "binary":
    case "none":
    default:
      return blank();
  }
}

function rampVisuals(count: number): OptionVisual[] {
  return Array.from({ length: count }, (_, i) => ({ level: i + 1, total: count }));
}

/**
 * Resolve the visuals for a question's options in stored order.
 * `likert5` has no option rows — its anchors are the fixed 5-point
 * agree/disagree scale, so it always takes the face ramp.
 */
export function visualsForQuestion(question: SurveyQuestion): { shape: ScaleShape; visuals: OptionVisual[] } {
  if (question.kind === "likert5") {
    return { shape: "agreement", visuals: visualsForShape("agreement", 5) };
  }
  if (question.kind === "yes_no") {
    return { shape: "binary", visuals: visualsForShape("binary", 2) };
  }
  if (question.kind !== "multiple_choice" && question.kind !== "dropdown") {
    return { shape: "none", visuals: [] };
  }
  const labels = question.options.map((o) => o.label_en ?? "");
  const shape = classifyScale(labels);
  return { shape, visuals: visualsForShape(shape, labels.length) };
}
