import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import type { QuestionKind, SurveyQuestion, SurveyOption } from "@/lib/surveys";

/**
 * Question Bank — the editable library of reusable questions.
 *
 * Replaces the read-only static constant in @/lib/instruments, which is now
 * only the seed fixture. Rows mirror survey_questions/survey_question_options
 * exactly, so importing a bank item into a survey is a column copy.
 *
 * Integrity model for the 8 seeded research instruments: every item keeps a
 * `source_snapshot` of its published wording/kind/options. Editing is never
 * blocked — but `isModified()` diffs the live row against that snapshot so the
 * UI can say "Modified from source", and `revertItem()` puts it back. A
 * modified BDI must never be mistakable for a real one.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankOption {
  id: string;
  order_index: number;
  label_en: string;
  label_te: string | null;
}

export interface BankItemSnapshot {
  prompt_en: string;
  prompt_te: string | null;
  kind: QuestionKind;
  options: { label_en: string; label_te: string | null }[];
}

export interface BankItem {
  id: string;
  instrument_id: string;
  order_index: number;
  kind: QuestionKind;
  prompt_en: string;
  prompt_te: string | null;
  required: boolean;
  is_builtin: boolean;
  source_snapshot: BankItemSnapshot | null;
  options: BankOption[];
}

export interface BankInstrument {
  id: string;
  code: string;
  name_en: string;
  name_te: string | null;
  blurb_en: string | null;
  blurb_te: string | null;
  source: string | null;
  order_index: number;
  is_builtin: boolean;
  source_item_count: number | null;
  items: BankItem[];
}

/**
 * The response types an author picks between, grouped the way the request
 * framed them: scale / text / radio / checkbox. `hasOptions` decides whether
 * the options editor appears — it must agree with QuestionRenderer, which only
 * reads options for these three kinds.
 */
export const BANK_KINDS: { value: QuestionKind; label: string; group: "choice" | "scale" | "text"; hasOptions: boolean }[] = [
  { value: "multiple_choice", label: "Radio — pick one", group: "choice", hasOptions: true },
  { value: "checkboxes", label: "Checkboxes — pick many", group: "choice", hasOptions: true },
  { value: "dropdown", label: "Dropdown — pick one", group: "choice", hasOptions: true },
  { value: "likert5", label: "Scale — Likert 1–5", group: "scale", hasOptions: false },
  { value: "rating5", label: "Scale — rating 1–5 stars", group: "scale", hasOptions: false },
  { value: "yes_no", label: "Yes / No", group: "scale", hasOptions: false },
  { value: "short_text", label: "Text — short answer", group: "text", hasOptions: false },
  { value: "long_text", label: "Text — long answer", group: "text", hasOptions: false },
];

export const kindMeta = (kind: QuestionKind) => BANK_KINDS.find((k) => k.value === kind) ?? BANK_KINDS[0];
export const kindHasOptions = (kind: QuestionKind) => kindMeta(kind).hasOptions;

// ---------------------------------------------------------------------------
// Integrity — is a built-in item still what it was published as?
// ---------------------------------------------------------------------------

/**
 * True when a seeded item no longer matches its published form. Custom items
 * (no snapshot) are never "modified" — there is nothing to diverge from.
 * Compares prompts, kind, and the full ordered option list; a reordered or
 * relabelled scale changes what the instrument measures just as much as an
 * edited prompt does.
 */
export function isItemModified(item: BankItem): boolean {
  const snap = item.source_snapshot;
  if (!snap) return false;
  if (item.prompt_en !== snap.prompt_en) return true;
  if ((item.prompt_te ?? null) !== (snap.prompt_te ?? null)) return true;
  if (item.kind !== snap.kind) return true;

  const live = item.options;
  const orig = snap.options ?? [];
  if (live.length !== orig.length) return true;
  return live.some((o, i) => o.label_en !== orig[i].label_en || (o.label_te ?? null) !== (orig[i].label_te ?? null));
}

/** An instrument diverges if any item was edited, or if items were added or removed. */
export function isInstrumentModified(inst: BankInstrument): boolean {
  if (!inst.is_builtin) return false;
  if (inst.source_item_count != null && inst.items.length !== inst.source_item_count) return true;
  return inst.items.some(isItemModified);
}

export function countModified(inst: BankInstrument): number {
  return inst.items.filter(isItemModified).length;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type IssueField = "prompt_en" | "options" | "name_en";

export interface Issue {
  field: IssueField;
  /** Index into item.options when the problem is one specific option. */
  optionIndex?: number;
  message: string;
}

/**
 * Everything wrong with a question, as a list rather than a boolean, so each
 * bad field can be highlighted where it lives instead of a single error at the
 * bottom of the form.
 *
 * Nothing here blocks saving. A half-written question is a normal intermediate
 * state — the bank autosaves as you type, and refusing to persist an empty
 * prompt would just lose the option list you were about to attach to it. These
 * are warnings that follow the row until it is finished.
 */
export function itemIssues(item: BankItem): Issue[] {
  const issues: Issue[] = [];

  if (!item.prompt_en.trim()) {
    issues.push({ field: "prompt_en", message: "Question text is required." });
  }

  if (kindHasOptions(item.kind)) {
    const usable = item.options.filter((o) => o.label_en.trim());
    if (item.options.length < 2) {
      issues.push({ field: "options", message: "Add at least two options." });
    } else if (usable.length < 2) {
      issues.push({ field: "options", message: "At least two options need a label." });
    }
    item.options.forEach((o, i) => {
      if (!o.label_en.trim()) {
        issues.push({ field: "options", optionIndex: i, message: `Option ${i + 1} needs a label.` });
      }
    });
  }

  return issues;
}

export const isItemIncomplete = (item: BankItem) => itemIssues(item).length > 0;

export function instrumentIssues(inst: BankInstrument): Issue[] {
  return inst.name_en.trim() ? [] : [{ field: "name_en", message: "Instrument name is required." }];
}

/** How many questions in an instrument still need attention. */
export const countIncomplete = (inst: BankInstrument): number => inst.items.filter(isItemIncomplete).length;

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

type OptionRow = { id: string; item_id: string; order_index: number; label_en: string; label_te: string | null };

export async function listBank(): Promise<BankInstrument[]> {
  const { data: instruments, error: iErr } = await supabase
    .from("question_bank_instruments")
    .select("*")
    .order("order_index");
  if (iErr) throw iErr;
  if (!instruments?.length) return [];

  const { data: items, error: itErr } = await supabase
    .from("question_bank_items")
    .select("*")
    .order("order_index");
  if (itErr) throw itErr;

  const itemIds = (items ?? []).map((i) => i.id);
  let options: OptionRow[] = [];
  if (itemIds.length) {
    const { data: opts, error: oErr } = await supabase
      .from("question_bank_item_options")
      .select("*")
      .in("item_id", itemIds)
      .order("order_index");
    if (oErr) throw oErr;
    options = (opts ?? []) as OptionRow[];
  }

  const byItem = new Map<string, BankOption[]>();
  for (const o of options) {
    const list = byItem.get(o.item_id) ?? [];
    list.push({ id: o.id, order_index: o.order_index, label_en: o.label_en, label_te: o.label_te });
    byItem.set(o.item_id, list);
  }

  const byInstrument = new Map<string, BankItem[]>();
  for (const it of items ?? []) {
    const list = byInstrument.get(it.instrument_id) ?? [];
    list.push({
      id: it.id,
      instrument_id: it.instrument_id,
      order_index: it.order_index,
      kind: it.kind as QuestionKind,
      prompt_en: it.prompt_en,
      prompt_te: it.prompt_te,
      required: it.required,
      is_builtin: it.is_builtin,
      source_snapshot: (it.source_snapshot as unknown as BankItemSnapshot | null) ?? null,
      options: byItem.get(it.id) ?? [],
    });
    byInstrument.set(it.instrument_id, list);
  }

  return instruments.map((i) => ({
    id: i.id,
    code: i.code,
    name_en: i.name_en,
    name_te: i.name_te,
    blurb_en: i.blurb_en,
    blurb_te: i.blurb_te,
    source: i.source,
    order_index: i.order_index,
    is_builtin: i.is_builtin,
    source_item_count: i.source_item_count,
    items: byInstrument.get(i.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Instruments — CRUD
// ---------------------------------------------------------------------------

/** Slug for a user-created instrument. Suffixed on collision so a duplicate
 *  name never trips the unique index and surfaces as a raw Postgres error. */
async function uniqueCode(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "instrument";
  const { data } = await supabase.from("question_bank_instruments").select("code").like("code", `${base}%`);
  const taken = new Set((data ?? []).map((r) => r.code));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
}

export async function createInstrument(input: {
  name_en: string;
  name_te?: string | null;
  blurb_en?: string | null;
  source?: string | null;
}): Promise<BankInstrument> {
  const { data: last } = await supabase
    .from("question_bank_instruments")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1);
  const order_index = last?.length ? last[0].order_index + 1 : 0;
  const { data: auth } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("question_bank_instruments")
    .insert({
      code: await uniqueCode(input.name_en),
      name_en: input.name_en,
      name_te: input.name_te || null,
      blurb_en: input.blurb_en || null,
      source: input.source || null,
      order_index,
      is_builtin: false,
      created_by: auth.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;

  await logAudit("bank.instrument.create", "question_bank_instrument", data.id, { name: input.name_en });
  return { ...data, items: [] } as BankInstrument;
}

export async function updateInstrument(
  id: string,
  patch: Partial<Pick<BankInstrument, "name_en" | "name_te" | "blurb_en" | "source">>,
): Promise<void> {
  const { error } = await supabase.from("question_bank_instruments").update(patch).eq("id", id);
  if (error) throw error;
}

/** Cascades to items and options via the FK. Survey questions already imported
 *  from this instrument are untouched — they were copied, not referenced. */
export async function deleteInstrument(id: string): Promise<void> {
  const { error } = await supabase.from("question_bank_instruments").delete().eq("id", id);
  if (error) throw error;
  await logAudit("bank.instrument.delete", "question_bank_instrument", id, {});
}

export async function reorderInstruments(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => supabase.from("question_bank_instruments").update({ order_index: i }).eq("id", id)),
  );
}

/** Copies an instrument and everything in it. The copy is always custom, even
 *  off a built-in: it is a new question set that happens to start from one, and
 *  flagging it against the published form would be meaningless. */
export async function duplicateInstrument(inst: BankInstrument): Promise<void> {
  const copy = await createInstrument({
    name_en: `${inst.name_en} (copy)`,
    name_te: inst.name_te ?? undefined,
    blurb_en: inst.blurb_en ?? undefined,
    source: inst.source ?? undefined,
  });
  for (const item of inst.items) {
    await createItem(copy.id, {
      kind: item.kind,
      prompt_en: item.prompt_en,
      prompt_te: item.prompt_te ?? undefined,
      required: item.required,
      options: item.options.map((o) => ({ label_en: o.label_en, label_te: o.label_te })),
      order_index: item.order_index,
    });
  }
  await logAudit("bank.instrument.duplicate", "question_bank_instrument", copy.id, { from: inst.id, items: inst.items.length });
}

// ---------------------------------------------------------------------------
// Items — CRUD
// ---------------------------------------------------------------------------

/** Four starting options, so a new choice question arrives ready to use — most
 *  research scales are 4–5 points, and re-adding options every time is friction.
 *  The administrator can add or remove from here. */
const DEFAULT_OPTIONS = [
  { label_en: "Option 1", label_te: null },
  { label_en: "Option 2", label_te: null },
  { label_en: "Option 3", label_te: null },
  { label_en: "Option 4", label_te: null },
];

export async function createItem(
  instrumentId: string,
  input: {
    kind: QuestionKind;
    prompt_en?: string;
    prompt_te?: string;
    required?: boolean;
    options?: { label_en: string; label_te: string | null }[];
    order_index?: number;
  },
): Promise<BankItem> {
  let order_index = input.order_index;
  if (order_index == null) {
    const { data: last } = await supabase
      .from("question_bank_items")
      .select("order_index")
      .eq("instrument_id", instrumentId)
      .order("order_index", { ascending: false })
      .limit(1);
    order_index = last?.length ? last[0].order_index + 1 : 0;
  }

  const { data: item, error } = await supabase
    .from("question_bank_items")
    .insert({
      instrument_id: instrumentId,
      order_index,
      kind: input.kind,
      prompt_en: input.prompt_en ?? "",
      prompt_te: input.prompt_te || null,
      required: input.required ?? true,
      is_builtin: false,
      source_snapshot: null,
    })
    .select("*")
    .single();
  if (error) throw error;

  let options: BankOption[] = [];
  const wanted = input.options ?? (kindHasOptions(input.kind) ? DEFAULT_OPTIONS : []);
  if (wanted.length) options = await replaceOptions(item.id, wanted);

  await logAudit("bank.item.create", "question_bank_item", item.id, { instrument_id: instrumentId, kind: input.kind });
  return {
    ...(item as Omit<BankItem, "options" | "source_snapshot" | "kind">),
    kind: item.kind as QuestionKind,
    source_snapshot: null,
    options,
  };
}

export async function updateItem(
  id: string,
  patch: Partial<Pick<BankItem, "prompt_en" | "prompt_te" | "required" | "kind">>,
): Promise<void> {
  const { error } = await supabase.from("question_bank_items").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await supabase.from("question_bank_items").delete().eq("id", id);
  if (error) throw error;
  await logAudit("bank.item.delete", "question_bank_item", id, {});
}

export async function duplicateItem(item: BankItem): Promise<BankItem> {
  return createItem(item.instrument_id, {
    kind: item.kind,
    prompt_en: item.prompt_en,
    prompt_te: item.prompt_te ?? undefined,
    required: item.required,
    options: item.options.map((o) => ({ label_en: o.label_en, label_te: o.label_te })),
  });
}

export async function reorderItems(orderedIds: string[]): Promise<void> {
  const { error } = await supabase.rpc("reorder_question_bank_items", { p_ids: orderedIds });
  if (error) throw error;
}

/**
 * Switches an item's response type, adding starter options when moving into a
 * choice kind that has none. Options are deliberately KEPT when moving to a
 * kind that ignores them (text, yes/no, scale): the change is often a misclick,
 * and silently destroying a hand-written 5-point scale is unrecoverable. They
 * are simply not rendered until the item is a choice kind again.
 */
export async function changeItemKind(item: BankItem, kind: QuestionKind): Promise<BankOption[]> {
  await updateItem(item.id, { kind });
  if (kindHasOptions(kind) && item.options.length === 0) {
    return replaceOptions(item.id, DEFAULT_OPTIONS);
  }
  return item.options;
}

// ---------------------------------------------------------------------------
// Options — CRUD
// ---------------------------------------------------------------------------

export async function addOption(itemId: string, orderIndex: number): Promise<BankOption> {
  const { data, error } = await supabase
    .from("question_bank_item_options")
    .insert({ item_id: itemId, order_index: orderIndex, label_en: "", label_te: null })
    .select("*")
    .single();
  if (error) throw error;
  return data as BankOption;
}

export async function updateOption(id: string, patch: { label_en?: string; label_te?: string | null }): Promise<void> {
  const { error } = await supabase.from("question_bank_item_options").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteOption(id: string): Promise<void> {
  const { error } = await supabase.from("question_bank_item_options").delete().eq("id", id);
  if (error) throw error;
}

export async function reorderOptions(orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, i) => supabase.from("question_bank_item_options").update({ order_index: i }).eq("id", id)),
  );
}

/** Swaps an item's whole option list. Used by revert and by seeding a new item. */
async function replaceOptions(itemId: string, options: { label_en: string; label_te: string | null }[]): Promise<BankOption[]> {
  await supabase.from("question_bank_item_options").delete().eq("item_id", itemId);
  if (!options.length) return [];
  const { data, error } = await supabase
    .from("question_bank_item_options")
    .insert(options.map((o, i) => ({ item_id: itemId, order_index: i, label_en: o.label_en, label_te: o.label_te })))
    .select("*");
  if (error) throw error;
  return (data ?? []) as BankOption[];
}

// ---------------------------------------------------------------------------
// Revert
// ---------------------------------------------------------------------------

/** Restores a built-in item to its published wording, kind and options. */
export async function revertItem(item: BankItem): Promise<BankItem> {
  const snap = item.source_snapshot;
  if (!snap) throw new Error("This question has no published version to restore.");

  await supabase
    .from("question_bank_items")
    .update({ prompt_en: snap.prompt_en, prompt_te: snap.prompt_te, kind: snap.kind })
    .eq("id", item.id);
  const options = await replaceOptions(item.id, snap.options ?? []);

  await logAudit("bank.item.revert", "question_bank_item", item.id, {});
  return { ...item, prompt_en: snap.prompt_en, prompt_te: snap.prompt_te, kind: snap.kind, options };
}

// ---------------------------------------------------------------------------
// Import into a survey
// ---------------------------------------------------------------------------

/**
 * Copies whole instruments into a survey. Replaces importInstruments() from
 * @/lib/instruments, which read the static constant and so could never see an
 * edit. Questions are copied, not linked: a survey already collecting responses
 * must not mutate because someone edited the bank afterwards.
 */
export async function importInstrumentsToSurvey(surveyId: string, instrumentIds: string[]): Promise<SurveyQuestion[]> {
  const bank = await listBank();
  const chosen = bank.filter((i) => instrumentIds.includes(i.id));
  if (!chosen.length) return [];

  const { data: batch, error: bErr } = await supabase
    .from("import_batches")
    .insert({ survey_id: surveyId, source_type: "pdf", file_name: chosen.map((c) => c.name_en).join(", "), question_count: 0 })
    .select("*")
    .single();
  if (bErr) throw bErr;

  const { data: existing } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: false })
    .limit(1);
  let nextIndex = existing?.length ? existing[0].order_index + 1 : 0;

  const created: SurveyQuestion[] = [];
  for (const inst of chosen) {
    for (const item of inst.items) {
      const { data: q, error: qErr } = await supabase
        .from("survey_questions")
        .insert({
          survey_id: surveyId,
          kind: item.kind,
          order_index: nextIndex++,
          prompt_en: item.prompt_en,
          prompt_te: item.prompt_te,
          required: item.required,
          origin: "pdf",
          source_ref: batch.id,
        })
        .select("*")
        .single();
      if (qErr) throw qErr;

      let options: SurveyOption[] = [];
      if (kindHasOptions(item.kind) && item.options.length) {
        const { data: opts, error: oErr } = await supabase
          .from("survey_question_options")
          .insert(item.options.map((o, i) => ({ question_id: q.id, order_index: i, label_en: o.label_en, label_te: o.label_te })))
          .select("*");
        if (oErr) throw oErr;
        options = (opts ?? []) as SurveyOption[];
      }
      created.push({ ...(q as Omit<SurveyQuestion, "options">), options });
    }
  }

  await supabase.from("import_batches").update({ question_count: created.length }).eq("id", batch.id);
  await logAudit("question.import.library", "survey", surveyId, {
    instruments: chosen.map((i) => i.code),
    count: created.length,
  });
  return created;
}

/** Copies a single bank question into a survey. */
export async function importItemToSurvey(surveyId: string, item: BankItem): Promise<SurveyQuestion> {
  const { data: existing } = await supabase
    .from("survey_questions")
    .select("order_index")
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: false })
    .limit(1);
  const order_index = existing?.length ? existing[0].order_index + 1 : 0;

  const { data: q, error } = await supabase
    .from("survey_questions")
    .insert({
      survey_id: surveyId,
      kind: item.kind,
      order_index,
      prompt_en: item.prompt_en,
      prompt_te: item.prompt_te,
      required: item.required,
      origin: "manual",
    })
    .select("*")
    .single();
  if (error) throw error;

  let options: SurveyOption[] = [];
  if (kindHasOptions(item.kind) && item.options.length) {
    const { data: opts } = await supabase
      .from("survey_question_options")
      .insert(item.options.map((o, i) => ({ question_id: q.id, order_index: i, label_en: o.label_en, label_te: o.label_te })))
      .select("*");
    options = (opts ?? []) as SurveyOption[];
  }
  return { ...(q as Omit<SurveyQuestion, "options">), options };
}
