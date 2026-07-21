import type { AnswerValue, SurveyQuestion } from "@/lib/surveys";

/**
 * The visual layer over validated response scales.
 *
 * Rule that governs everything here: the glyph may restate the option's
 * POSITION on its scale, never a judgement about the answer. Everything below
 * follows from that one sentence.
 *
 *  - A scale must be recognisably ORDERED before it gets any ramp at all. A
 *    city list or BDI's grouped statements get nothing — inventing an order for
 *    unordered options is the same error as editorialising.
 *  - An ordered scale gets a ramp whose glyphs track the scale's own direction:
 *    index 0 is the low end, the last index is the high end. On a stress item
 *    the low end is calm and the high end is overwhelmed, so the ramp runs
 *    😌 → 😫. That restates "how much stress did I just report", which is
 *    exactly what the item asks.
 *  - The ramp's VOCABULARY comes from what the question is about. "How often do
 *    you feel lonely" and "how confident are you" are both 5-point frequency
 *    scales, but a single generic smiley ramp makes them read identically. The
 *    domain lookup below gives each its own faces.
 *  - Behavioural frequency items — how often you did a THING, not how often you
 *    FELT something — keep the neutral step meter. On a CIUS item like "how
 *    often are you short of sleep because of the internet", a 😊 against
 *    "Never" turns a frequency report into praise, which changes what the
 *    instrument measures.
 *
 * Scoring is untouched everywhere: option order, ids and stored values are
 * exactly what the instrument defines. The emoji is a display layer that is
 * also recorded alongside the answer, so an export can show the respondent's
 * screen rather than a bare integer.
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

/**
 * What the question is asking about. Chosen from the prompt, not the options,
 * because the options ("Never…Always") are identical across a whole instrument
 * while the prompt is what actually differs item to item.
 */
export type EmotionDomain =
  | "mood"
  | "happiness"
  | "stress"
  | "anger"
  | "fear"
  | "energy"
  | "sleep"
  | "hope"
  | "loneliness"
  | "comfort"
  | "confidence"
  | "support"
  | "concern"
  | "health"
  /** ordered, emotionally neutral — a plain assent/intensity ramp */
  | "generic"
  /** a behaviour count, not a feeling — no faces */
  | "behaviour";

export interface OptionVisual {
  emoji?: string;
  /** 1-based step on an ordered meter of `total` steps. */
  level?: number;
  total?: number;
}

/**
 * Five-step ramps, ALWAYS written low-end-of-scale → high-end-of-scale.
 *
 * For domains where "more" is harder (stress, anger, fear, loneliness,
 * concern) that means the ramp starts calm and ends distressed. That is not a
 * value judgement on the respondent — it is the shape of the axis they were
 * handed, drawn back to them.
 */
const RAMPS: Record<Exclude<EmotionDomain, "behaviour">, string[]> = {
  mood: ["😢", "😔", "😐", "🙂", "😊"],
  happiness: ["😞", "😔", "😐", "🙂", "😃"],
  stress: ["😌", "🙂", "😐", "😰", "😫"],
  anger: ["😌", "🙂", "😐", "😠", "😡"],
  fear: ["😌", "🙂", "😐", "😟", "😨"],
  energy: ["😴", "🥱", "😐", "🙂", "😃"],
  sleep: ["😴", "🥱", "😐", "🙂", "😌"],
  hope: ["😞", "😔", "😐", "🙂", "😊"],
  loneliness: ["😊", "🙂", "😐", "😔", "😢"],
  comfort: ["😰", "😟", "😐", "🙂", "😌"],
  confidence: ["😞", "😟", "😐", "🙂", "😃"],
  support: ["💔", "😔", "😐", "🙂", "❤️"],
  concern: ["😌", "🙂", "😐", "😟", "😰"],
  health: ["🤒", "😔", "😐", "🙂", "😊"],
  generic: ["😢", "🙁", "😐", "🙂", "😊"],
};

/**
 * Prompt keywords → domain. Ordered most specific first: "lonely" must win
 * over the generic "feel", and "angry" over "upset".
 */
const DOMAIN_PATTERNS: [EmotionDomain, RegExp][] = [
  ["loneliness", /\b(lonely|loneliness|alone|isolated|left out|no ?one)\b/i],
  ["anger", /\b(anger|angry|furious|irritat\w*|temper|rage|annoyed|hot[- ]headed)\b/i],
  ["fear", /\b(afraid|fear\w*|scared|frightened|panic|anxious|anxiety|nervous)\b/i],
  ["stress", /\b(stress\w*|pressure|overwhelm\w*|tense|strain|burden|cope|coping)\b/i],
  ["sleep", /\b(sleep\w*|rest\w*|insomnia|awake|tired at night)\b/i],
  ["energy", /\b(energy|energetic|active|tired|fatigue|exhaust\w*|worn out|lively|vigor\w*)\b/i],
  ["hope", /\b(hope\w*|future|optimis\w*|look forward|give up|discourag\w*|despair)\b/i],
  ["support", /\b(support\w*|family|relatives|friends|help me|there for me|cared for|belong\w*)\b/i],
  ["confidence", /\b(confiden\w*|capable|self[- ]?esteem|believe in myself|able to|competent|control)\b/i],
  ["comfort", /\b(comfort\w*|safe|secure|at ease|relaxed|calm|peaceful)\b/i],
  ["concern", /\b(worry|worried|concern\w*|trouble\w*|bother\w*|uneasy)\b/i],
  ["health", /\b(health\w*|unwell|ill\b|illness|pain|appetite|body|physical)\b/i],
  ["happiness", /\b(happy|happiness|joy\w*|cheerful|content\w*|good spirits|pleased|enjoy\w*)\b/i],
  ["mood", /\b(mood|feel\w*|emotion\w*|sad\w*|down|low\b|spirits|depress\w*|cry\w*)\b/i],
];

/**
 * Items that count a BEHAVIOUR rather than report a feeling. These keep the
 * neutral meter even when the scale is perfectly ordered.
 */
const BEHAVIOUR_RE =
  /\b(internet|online|phone|screen|computer|game|gambl\w*|drink\w*|alcohol|smok\w*|drug|spend\w*|hours|website|social media|app\b)\b/i;

export function classifyDomain(promptEn: string): EmotionDomain {
  const p = promptEn ?? "";
  if (BEHAVIOUR_RE.test(p)) return "behaviour";
  for (const [domain, re] of DOMAIN_PATTERNS) {
    if (re.test(p)) return domain;
  }
  return "generic";
}

const AGREEMENT_RE = /\b(agree|disagree)\b/i;
const FREQUENCY_RE =
  /\b(never|seldom|rarely|sometimes|often|always|at no time|all of the time|most of the time|half the time|some of the time)\b/i;
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

/**
 * Resample a 5-step ramp onto `count` steps, keeping both ends anchored. A
 * 3-point scale therefore reads low / middle / high rather than the first
 * three faces of a five-point ramp.
 */
function resample(ramp: string[], count: number): string[] {
  if (count === ramp.length) return ramp;
  if (count === 1) return [ramp[Math.floor(ramp.length / 2)]];
  return Array.from({ length: count }, (_, i) =>
    ramp[Math.round((i / (count - 1)) * (ramp.length - 1))],
  );
}

function rampVisuals(count: number): OptionVisual[] {
  return Array.from({ length: count }, (_, i) => ({ level: i + 1, total: count }));
}

/**
 * Whether a scale of this shape may carry faces at all.
 *
 * An AGREEMENT scale always may: "how much do I assent" is what the ramp
 * restates, whatever the item is about.
 *
 * A FREQUENCY, TRUTH or DESCRIPTION scale may only when the prompt is
 * recognisably about a feeling. Those three shapes report an amount of
 * something, and a face against "Never" is only a restatement if the something
 * IS an emotion — otherwise it is praise. When the domain lookup comes back
 * "generic" the platform does not know what is being counted, and the honest
 * response to not knowing is the neutral meter, not a guess.
 */
function facesAllowed(shape: ScaleShape, domain: EmotionDomain): boolean {
  if (domain === "behaviour") return false;
  if (shape === "agreement" || shape === "intensity") return true;
  return domain !== "generic";
}

/** Visuals for an ordered scale of `count` options, index 0 first. */
export function visualsForShape(shape: ScaleShape, count: number, domain: EmotionDomain = "generic"): OptionVisual[] {
  const blank = () => Array.from({ length: count }, () => ({}) as OptionVisual);

  switch (shape) {
    case "agreement":
    case "frequency":
    case "truth":
    case "description":
    case "intensity": {
      if (!facesAllowed(shape, domain)) return rampVisuals(count);
      // Beyond 7 steps the faces stop being distinguishable at a glance and the
      // meter carries the ordering better.
      if (count < 3 || count > 7) return rampVisuals(count);
      const faces = resample(RAMPS[domain], count);
      return faces.map((emoji, i) => ({ emoji, level: i + 1, total: count }));
    }
    case "binary":
    case "none":
    default:
      return blank();
  }
}

/**
 * Resolve the visuals for a question's options in stored order.
 * `likert5` has no option rows — its anchors are the fixed 5-point
 * agree/disagree scale, so it always takes a ramp.
 */
export function visualsForQuestion(question: SurveyQuestion): {
  shape: ScaleShape;
  domain: EmotionDomain;
  visuals: OptionVisual[];
} {
  const domain = classifyDomain(question.prompt_en ?? "");

  if (question.kind === "likert5") {
    return { shape: "agreement", domain, visuals: visualsForShape("agreement", 5, domain) };
  }
  if (question.kind === "rating5") {
    return { shape: "intensity", domain, visuals: visualsForShape("intensity", 5, domain) };
  }
  if (question.kind === "yes_no") {
    return { shape: "binary", domain, visuals: visualsForShape("binary", 2, domain) };
  }
  if (question.kind !== "multiple_choice" && question.kind !== "dropdown") {
    return { shape: "none", domain, visuals: [] };
  }
  const labels = question.options.map((o) => o.label_en ?? "");
  const shape = classifyScale(labels);
  return { shape, domain, visuals: visualsForShape(shape, labels.length, domain) };
}

/**
 * The emoji the respondent actually saw next to the answer they chose, or null
 * when that answer had no glyph. This is what gets recorded with the response
 * and reproduced in every export, so a reviewer reading a spreadsheet sees the
 * same thing the family saw on the screen.
 */
export function emojiForAnswer(question: SurveyQuestion, value: AnswerValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  const { visuals } = visualsForQuestion(question);
  if (!visuals.length) return null;

  const at = (i: number) => (i >= 0 && i < visuals.length ? (visuals[i].emoji ?? null) : null);

  switch (question.kind) {
    case "likert5":
    case "rating5":
      return typeof value === "number" ? at(value - 1) : null;
    case "multiple_choice":
    case "dropdown":
      return at(question.options.findIndex((o) => o.id === value));
    default:
      return null;
  }
}
