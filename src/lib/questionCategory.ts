import type { SurveyQuestion } from "@/lib/surveys";

/**
 * What a question is *about*, used only to pick an ambient wash behind it.
 *
 * The interface adapts to the subject so that a question about a dead child and
 * a question about internet habits do not arrive on an identical white
 * rectangle. It adapts very slightly — see the `.atmo-*` block in index.css for
 * why anything stronger would be a measurement problem rather than a design
 * choice.
 *
 * Classification reads `prompt_en`. Telugu is optional per question and is
 * sometimes absent entirely, so matching on it would make the atmosphere
 * flicker between language modes for the same item. English is always authored.
 */

export type QuestionCategory =
  | "family"
  | "empathy"
  | "hope"
  | "depression"
  | "internet"
  | "wellbeing"
  | "stress"
  | "anger"
  | "neutral";

/**
 * Beck Depression Inventory items reach the database as their bare header word
 * — "Sadness", "Guilt", "Crying" — because each item's four graded statements
 * live in its options rather than its prompt. They are matched exactly and
 * first, because several of them ("Irritability", "Sleep", "Appetite") would
 * otherwise be captured by a generic rule and land in the wrong category.
 */
const BDI_HEADERS = new Set([
  "sadness",
  "pessimism",
  "sense of failure",
  "loss of satisfaction",
  "guilt",
  "punishment",
  "self-dislike",
  "self-criticism",
  "suicidal thoughts",
  "crying",
  "irritability",
  "loss of interest",
  "indecisiveness",
  "worthlessness (appearance)",
  "loss of energy (work)",
  "sleep",
  "tiredness",
  "appetite",
  "weight loss",
  "health worry",
  "loss of interest in sex",
]);

/**
 * Ordered rules. The order is the whole design: earlier entries are narrower
 * and would be swallowed by later ones.
 *
 *  - `internet` leads because CIUS items are phrased as frequencies ("how often
 *    do you feel restless... when you cannot use the internet") that read as
 *    stress or anger on every other rule.
 *  - `family` precedes the affective rules because "I fear being alone" style
 *    items should stay generic, while anything naming a spouse, a child or the
 *    household is about the family whatever emotion it carries.
 *  - `anger` precedes `depression` only for its explicit vocabulary; BDI's
 *    "Irritability" is already claimed by the exact-header pass above.
 *  - `wellbeing` is last of the substantive rules because WHO-5's vocabulary
 *    ("calm", "interest") is the most easily borrowed by other instruments.
 */
const RULES: { category: QuestionCategory; test: RegExp }[] = [
  { category: "internet", test: /\b(internet|online|web|social media|screen time)\b/i },
  {
    category: "family",
    test: /\b(family|families|spouse|husband|wife|partner|child|children|son|daughter|parents?|mother|father|household|home life|relatives?|in-laws)\b/i,
  },
  {
    category: "anger",
    test: /\b(anger|angry|temper|quick-tempered|hot-headed|furious|infuriated|enraged|annoyed|irritated|rage|fly off the handle|hitting someone|nasty things)\b/i,
  },
  {
    category: "depression",
    test: /\b(sad|sadness|depress\w*|worthless|hopeless|killing myself|suicid\w*|end my life|guilt\w*|failure|discouraged|unhappy|cry\b|crying|no appetite|disgusted with myself|hate myself)\b/i,
  },
  {
    category: "hope",
    test: /\b(future|hope\w*|look forward|optimis\w*|things will|better days|improve)\b/i,
  },
  {
    category: "empathy",
    // The perspective-taking subscale of the IRI almost never says "empathy".
    // It says "in their place", "in their shoes", "imagine how I would feel" —
    // the construct is described rather than named, so the idioms have to be
    // matched literally or all 28 items fall through to neutral.
    test: /\b(empath\w*|compassion\w*|other people'?s?|others'? (feelings|point of view)|point of view|perspective|put myself in|in (their|his|her|the other person'?s) (place|shoes|position)|imagine how (i|you) would feel|how i would feel if|sorry for|pity|tender|soft-hearted|misfortunes?|less fortunate)\b/i,
  },
  {
    category: "wellbeing",
    test: /\b(cheerful|good spirits|calm|relaxed|vigorous|rested|fresh|well-?being|content(ed)?|satisfied with (my )?life|energy|active)\b/i,
  },
  {
    category: "stress",
    test: /\b(stress\w*|anxious|anxiety|worr\w*|tense|nervous|restless|panic|overwhelm\w*|pressure|impulse|impulsive|reckless|on edge)\b/i,
  },
];

export function categorizeQuestion(question: SurveyQuestion): QuestionCategory {
  const prompt = (question.prompt_en ?? "").trim();
  if (!prompt) return "neutral";

  if (BDI_HEADERS.has(prompt.toLowerCase())) return "depression";

  for (const rule of RULES) {
    if (rule.test.test(prompt)) return rule.category;
  }

  // Deliberately conservative. An ambiguous item gets the neutral wash rather
  // than a guess: the wrong atmosphere on a suicidality item is worse than no
  // atmosphere on any item.
  return "neutral";
}

export function categoryClass(category: QuestionCategory): string {
  return `atmo-${category}`;
}
