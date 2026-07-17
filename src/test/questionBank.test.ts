import { describe, it, expect, vi } from "vitest";

// questionBank imports the browser Supabase client at module scope, which needs
// import.meta.env. These tests cover the pure integrity logic, so the client is
// stubbed rather than configured.
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));

const {
  isItemModified, isInstrumentModified, countModified, kindHasOptions, BANK_KINDS,
  itemIssues, isItemIncomplete, instrumentIssues, countIncomplete,
} = await import("@/lib/questionBank");

type Item = Parameters<typeof isItemModified>[0];

/** A seeded built-in item that currently matches its published form. */
function builtin(overrides: Partial<Item> = {}): Item {
  const base: Item = {
    id: "i1",
    instrument_id: "inst1",
    order_index: 0,
    kind: "multiple_choice",
    prompt_en: "I have a fiery temper.",
    prompt_te: null,
    required: true,
    is_builtin: true,
    source_snapshot: {
      prompt_en: "I have a fiery temper.",
      prompt_te: null,
      kind: "multiple_choice",
      options: [
        { label_en: "Almost never", label_te: "దాదాపు ఎప్పుడూ కాదు" },
        { label_en: "Sometimes", label_te: "కొన్నిసార్లు" },
      ],
    },
    options: [
      { id: "o1", order_index: 0, label_en: "Almost never", label_te: "దాదాపు ఎప్పుడూ కాదు" },
      { id: "o2", order_index: 1, label_en: "Sometimes", label_te: "కొన్నిసార్లు" },
    ],
  };
  return { ...base, ...overrides };
}

describe("question bank — modification detection", () => {
  it("treats an untouched built-in as unmodified", () => {
    expect(isItemModified(builtin())).toBe(false);
  });

  it("never flags a custom question, which has no published form to diverge from", () => {
    const custom = builtin({ is_builtin: false, source_snapshot: null, prompt_en: "anything at all" });
    expect(isItemModified(custom)).toBe(false);
  });

  it("flags an edited prompt", () => {
    expect(isItemModified(builtin({ prompt_en: "I have a mild temper." }))).toBe(true);
  });

  it("flags an added translation", () => {
    expect(isItemModified(builtin({ prompt_te: "నాకు కోపం ఎక్కువ." }))).toBe(true);
  });

  it("flags a changed response type — the whole point of the guard", () => {
    // Turning a validated Likert-style item into free text destroys its scoring.
    expect(isItemModified(builtin({ kind: "short_text" }))).toBe(true);
  });

  it("flags a relabelled option", () => {
    const item = builtin();
    item.options[1] = { ...item.options[1], label_en: "Occasionally" };
    expect(isItemModified(item)).toBe(true);
  });

  it("flags a reordered scale, which changes what the numbers mean", () => {
    const item = builtin();
    item.options = [item.options[1], item.options[0]];
    expect(isItemModified(item)).toBe(true);
  });

  it("flags added and removed options", () => {
    expect(isItemModified(builtin({ options: [builtin().options[0]] }))).toBe(true);
    expect(
      isItemModified(
        builtin({ options: [...builtin().options, { id: "o3", order_index: 2, label_en: "Often", label_te: null }] }),
      ),
    ).toBe(true);
  });

  it("treats a dropped Telugu label as a modification", () => {
    const item = builtin();
    item.options[0] = { ...item.options[0], label_te: null };
    expect(isItemModified(item)).toBe(true);
  });

  it("does not confuse null and undefined translations", () => {
    // Postgres returns null; the snapshot may omit the key entirely.
    const item = builtin({ prompt_te: null });
    item.source_snapshot = { ...item.source_snapshot!, prompt_te: undefined as unknown as null };
    expect(isItemModified(item)).toBe(false);
  });
});

describe("question bank — instrument-level divergence", () => {
  const instrument = (items: Item[], extra: Record<string, unknown> = {}) =>
    ({
      id: "inst1",
      code: "trait_anger",
      name_en: "Trait Anger Scale",
      name_te: null,
      blurb_en: null,
      blurb_te: null,
      source: null,
      order_index: 0,
      is_builtin: true,
      source_item_count: 2,
      items,
      ...extra,
    }) as Parameters<typeof isInstrumentModified>[0];

  it("is unmodified when every item matches and none were added or removed", () => {
    expect(isInstrumentModified(instrument([builtin(), builtin({ id: "i2" })]))).toBe(false);
  });

  it("is modified when any item was edited", () => {
    expect(isInstrumentModified(instrument([builtin(), builtin({ id: "i2", prompt_en: "changed" })]))).toBe(true);
  });

  it("is modified when an item was removed, even though every survivor is untouched", () => {
    // The count is why source_item_count exists: no individual item is dirty here.
    expect(isInstrumentModified(instrument([builtin()]))).toBe(true);
  });

  it("is modified when an item was added", () => {
    const added = builtin({ id: "i3", is_builtin: false, source_snapshot: null });
    expect(isInstrumentModified(instrument([builtin(), builtin({ id: "i2" }), added]))).toBe(true);
  });

  it("never flags a custom instrument", () => {
    expect(isInstrumentModified(instrument([builtin({ prompt_en: "x" })], { is_builtin: false }))).toBe(false);
  });

  it("counts only the changed items", () => {
    expect(countModified(instrument([builtin(), builtin({ id: "i2", prompt_en: "changed" })]))).toBe(1);
  });
});

describe("question bank — validation issues", () => {
  it("accepts a complete choice question", () => {
    expect(itemIssues(builtin())).toEqual([]);
    expect(isItemIncomplete(builtin())).toBe(false);
  });

  it("flags a blank prompt, including whitespace-only", () => {
    expect(itemIssues(builtin({ prompt_en: "" })).map((i) => i.field)).toContain("prompt_en");
    expect(itemIssues(builtin({ prompt_en: "   " })).map((i) => i.field)).toContain("prompt_en");
  });

  it("requires at least two options on a choice kind", () => {
    const one = builtin({ options: [builtin().options[0]] });
    expect(itemIssues(one).some((i) => i.field === "options")).toBe(true);
  });

  it("points at the exact blank option, not just the list", () => {
    const item = builtin();
    item.options[1] = { ...item.options[1], label_en: "  " };
    const issues = itemIssues(item);
    // One issue for the specific option; the list-level "two labels" rule also
    // fires because only one usable option remains.
    expect(issues.filter((i) => i.field === "options" && i.optionIndex === 1)).toHaveLength(1);
    expect(issues.some((i) => i.field === "options" && i.optionIndex == null)).toBe(true);
  });

  it("never asks text or scale kinds for options", () => {
    expect(itemIssues(builtin({ kind: "short_text", options: [] }))).toEqual([]);
    expect(itemIssues(builtin({ kind: "likert5", options: [] }))).toEqual([]);
    expect(itemIssues(builtin({ kind: "yes_no", options: [] }))).toEqual([]);
  });

  it("counts incomplete items per instrument and flags a blank instrument name", () => {
    const inst = {
      id: "i", code: "c", name_en: " ", name_te: null, blurb_en: null, blurb_te: null,
      source: null, order_index: 0, is_builtin: false, source_item_count: null,
      items: [builtin(), builtin({ id: "i2", prompt_en: "" })],
    } as Parameters<typeof countIncomplete>[0];
    expect(countIncomplete(inst)).toBe(1);
    expect(instrumentIssues(inst).map((i) => i.field)).toEqual(["name_en"]);
  });
});

describe("question bank — debounce keying (regression)", () => {
  // Mirrors fieldKey() in QuestionBank.tsx. Keyed on the row id alone, typing
  // the English prompt then the Telugu one within the 500ms window had the
  // second keystroke cancel the first's pending save — and since each patch
  // carries only the changed field, the English text was never sent.
  const fieldKey = (id: string, patch: object) => `${id}:${Object.keys(patch).sort().join(",")}`;

  it("gives each field of a row its own timer", () => {
    expect(fieldKey("q1", { prompt_en: "a" })).not.toBe(fieldKey("q1", { prompt_te: "b" }));
    expect(fieldKey("o1", { label_en: "a" })).not.toBe(fieldKey("o1", { label_te: "b" }));
  });

  it("still coalesces repeated edits to the same field", () => {
    expect(fieldKey("q1", { prompt_en: "a" })).toBe(fieldKey("q1", { prompt_en: "ab" }));
  });

  it("keeps different rows independent", () => {
    expect(fieldKey("q1", { prompt_en: "a" })).not.toBe(fieldKey("q2", { prompt_en: "a" }));
  });
});

describe("question bank — clearing optional fields (regression)", () => {
  // supabase-js omits undefined keys from the PATCH body, so `|| undefined`
  // meant a cleared field kept its old DB value while the UI showed it blank.
  const toPatch = (v: { name_te: string }) => ({ name_te: v.name_te.trim() || null });

  it("sends null for a cleared field so the clear is actually written", () => {
    const patch = toPatch({ name_te: "   " });
    expect(patch.name_te).toBeNull();
    expect(Object.keys(patch)).toContain("name_te");
    expect(JSON.stringify(patch)).toBe('{"name_te":null}');
  });

  it("undefined would have been dropped from the payload entirely", () => {
    expect(JSON.stringify({ name_te: undefined })).toBe("{}");
  });
});

describe("question bank — response types", () => {
  it("offers a type for each of scale, text, radio and checkbox", () => {
    const groups = new Set(BANK_KINDS.map((k) => k.group));
    expect(groups).toEqual(new Set(["choice", "scale", "text"]));
    expect(BANK_KINDS.map((k) => k.value)).toContain("multiple_choice"); // radio
    expect(BANK_KINDS.map((k) => k.value)).toContain("checkboxes");
    expect(BANK_KINDS.map((k) => k.value)).toContain("likert5"); // scale
    expect(BANK_KINDS.map((k) => k.value)).toContain("short_text"); // text input
  });

  it("marks exactly the option-bearing kinds — must agree with QuestionRenderer", () => {
    // QuestionRenderer only reads question.options for these three; any other
    // kind showing an options editor would be editing something invisible.
    expect(BANK_KINDS.filter((k) => k.hasOptions).map((k) => k.value)).toEqual([
      "multiple_choice",
      "checkboxes",
      "dropdown",
    ]);
    expect(kindHasOptions("short_text")).toBe(false);
    expect(kindHasOptions("yes_no")).toBe(false);
    expect(kindHasOptions("likert5")).toBe(false);
  });
});
