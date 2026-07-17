import { describe, expect, it } from "vitest";
import { classifyScale, visualsForQuestion } from "@/lib/answerVisuals";
import { chunkText } from "@/lib/voice";
import {
  countAnswered,
  estimateSeconds,
  firstUnansweredIndex,
  formatReferenceId,
  isAnswered,
  minutesFromSeconds,
  remainingSeconds,
} from "@/lib/assessmentSession";
import { interpolate } from "@/lib/i18n";
import type { SurveyQuestion, AnswerValue } from "@/lib/surveys";

function q(id: string, over: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return {
    id,
    survey_id: "s",
    order_index: 0,
    kind: "likert5",
    prompt_en: "prompt",
    prompt_te: null,
    required: true,
    origin: "manual",
    source_ref: null,
    section_id: null,
    options: [],
    ...over,
  };
}

function opt(id: string, label_en: string) {
  return { id, question_id: "q", order_index: 0, label_en, label_te: null };
}

describe("answerVisuals: classifyScale", () => {
  it("recognises an agreement scale", () => {
    expect(classifyScale(["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"])).toBe("agreement");
  });

  it("treats a frequency scale as frequency, not agreement", () => {
    // A CIUS frequency scale must NOT get faces — 😊 on "Never" would praise the answer.
    expect(classifyScale(["Never", "Seldom", "Sometimes", "Often", "Very often"])).toBe("frequency");
  });

  it("recognises truth and description scales", () => {
    expect(classifyScale(["Very false", "Somewhat false", "Somewhat true", "Very true"])).toBe("truth");
    expect(classifyScale(["Does not describe me well", "1", "2", "3", "Describes me very well"])).toBe("description");
  });

  it("recognises yes/no as binary", () => {
    expect(classifyScale(["Yes", "No"])).toBe("binary");
  });

  it("does not invent order for an unordered list", () => {
    expect(classifyScale(["Hyderabad", "Vijayawada", "Visakhapatnam"])).toBe("none");
  });

  it("needs two anchors before calling something a truth scale", () => {
    // A lone 'true' inside an otherwise unordered list is not a truth scale.
    expect(classifyScale(["Blue", "It is true I like green", "Red"])).toBe("none");
  });
});

describe("answerVisuals: visualsForQuestion", () => {
  it("gives likert5 the five-face ramp in scale order", () => {
    const { shape, visuals } = visualsForQuestion(q("a", { kind: "likert5" }));
    expect(shape).toBe("agreement");
    expect(visuals.map((v) => v.emoji)).toEqual(["😢", "🙁", "😐", "🙂", "😊"]);
  });

  it("gives a frequency multiple-choice a neutral meter, no emoji", () => {
    const question = q("a", {
      kind: "multiple_choice",
      options: [opt("1", "Never"), opt("2", "Sometimes"), opt("3", "Often"), opt("4", "Always")],
    });
    const { shape, visuals } = visualsForQuestion(question);
    expect(shape).toBe("frequency");
    expect(visuals.every((v) => v.emoji === undefined)).toBe(true);
    expect(visuals.map((v) => v.level)).toEqual([1, 2, 3, 4]);
  });

  it("leaves an unordered choice list with no visuals", () => {
    const question = q("a", {
      kind: "multiple_choice",
      options: [opt("1", "Red"), opt("2", "Green"), opt("3", "Blue")],
    });
    const { shape, visuals } = visualsForQuestion(question);
    expect(shape).toBe("none");
    expect(visuals.every((v) => v.emoji === undefined && v.level === undefined)).toBe(true);
  });
});

describe("voice: chunkText", () => {
  it("keeps a short prompt as a single chunk", () => {
    expect(chunkText("How are you feeling today?")).toEqual(["How are you feeling today?"]);
  });

  it("prefers sentence boundaries when the limit forces a split", () => {
    // A small limit forces the split; it should land between whole sentences,
    // not mid-word.
    const chunks = chunkText("First sentence. Second sentence. Third one.", 20);
    expect(chunks.length).toBe(3);
    expect(chunks[0]).toBe("First sentence.");
    expect(chunks[2]).toBe("Third one.");
  });

  it("never emits a chunk longer than the limit", () => {
    const long = "word ".repeat(200);
    for (const chunk of chunkText(long, 160)) {
      expect(chunk.length).toBeLessThanOrEqual(160);
    }
  });

  it("splits on the Telugu danda when over the limit", () => {
    const chunks = chunkText("మీరు ఎలా ఉన్నారు। ఇది రెండవ వాక్యం।", 20);
    expect(chunks.length).toBe(2);
  });
});

describe("assessmentSession: answers", () => {
  it("treats blank strings and empty arrays as unanswered", () => {
    expect(isAnswered("")).toBe(false);
    expect(isAnswered("  ")).toBe(false);
    expect(isAnswered([])).toBe(false);
    expect(isAnswered(null)).toBe(false);
    expect(isAnswered(undefined)).toBe(false);
    expect(isAnswered(0)).toBe(true); // a likert value of 0 would still count, though scale is 1–5
    expect(isAnswered("yes")).toBe(true);
    expect(isAnswered(["a"])).toBe(true);
  });

  it("counts answered and finds the first gap", () => {
    const questions = [q("a"), q("b"), q("c")];
    const answers: Record<string, AnswerValue> = { a: 3, c: 5 };
    expect(countAnswered(questions, answers)).toBe(2);
    expect(firstUnansweredIndex(questions, answers)).toBe(1);
    expect(firstUnansweredIndex(questions, { a: 1, b: 2, c: 3 })).toBe(-1);
  });
});

describe("assessmentSession: time", () => {
  it("estimates by question kind", () => {
    const short = estimateSeconds([q("a", { kind: "yes_no" })]);
    const long = estimateSeconds([q("a", { kind: "long_text" })]);
    expect(long).toBeGreaterThan(short);
  });

  it("only counts remaining unanswered questions from the cursor", () => {
    const questions = [q("a", { kind: "likert5" }), q("b", { kind: "likert5" }), q("c", { kind: "likert5" })];
    const all = remainingSeconds(questions, {}, 0);
    const fromMiddle = remainingSeconds(questions, {}, 1);
    expect(all).toBeGreaterThan(fromMiddle);
    // Answering the current question drops it from the remaining estimate.
    expect(remainingSeconds(questions, { b: 3, c: 3 }, 1)).toBe(0);
  });

  it("rounds minutes up to at least one", () => {
    expect(minutesFromSeconds(10)).toBe(1);
    expect(minutesFromSeconds(200)).toBe(3);
  });
});

describe("assessmentSession: reference id", () => {
  it("formats a uuid into a readable, grouped reference", () => {
    expect(formatReferenceId("1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d")).toBe("1A2B-3C4D-5E6F");
  });
});

describe("i18n: interpolate", () => {
  it("substitutes named placeholders", () => {
    expect(interpolate("Question {i} of {n}", { i: 3, n: 12 })).toBe("Question 3 of 12");
  });
  it("leaves unknown placeholders intact and returns raw text without vars", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
    expect(interpolate("No placeholders")).toBe("No placeholders");
  });
});
