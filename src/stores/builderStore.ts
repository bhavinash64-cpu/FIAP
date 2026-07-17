import { create } from "zustand";
import { toast } from "sonner";
import {
  QUESTION_KINDS,
  addOption,
  createQuestion,
  createSection,
  deleteOption,
  deleteQuestion,
  deleteSection,
  duplicateQuestion,
  getSurveyWithQuestions,
  reorderOptions,
  reorderQuestions,
  reorderSections,
  updateOption,
  updateQuestion,
  updateSection,
  updateSurveyMeta,
  type QuestionKind,
  type Survey,
  type SurveyQuestion,
  type SurveySection,
} from "@/lib/surveys";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Builder state is normalized (`byId` + `order`) rather than an array so a
 * keystroke in one question only changes that question's object identity.
 * Rows subscribe with `useQuestion(id)`, so typing re-renders exactly one row
 * instead of the whole list — the single biggest win on the 130-question survey.
 */
interface BuilderState {
  survey: Survey | null;
  byId: Record<string, SurveyQuestion>;
  order: string[];
  sections: SurveySection[];
  loading: boolean;
  saveState: SaveState;

  // View state — lives here so the toolbar and list stay in sync without prop drilling.
  search: string;
  kindFilter: QuestionKind | "all";
  requiredFilter: "all" | "required" | "optional";
  focusedId: string | null;

  load: (surveyId: string) => Promise<void>;
  reset: () => void;

  setSearch: (v: string) => void;
  setKindFilter: (v: QuestionKind | "all") => void;
  setRequiredFilter: (v: "all" | "required" | "optional") => void;
  setFocused: (id: string | null) => void;

  setMeta: (patch: Partial<Pick<Survey, "title_en" | "title_te" | "description_en" | "description_te">>) => void;
  setSurveyStatus: (patch: Partial<Survey>) => void;

  addQuestion: (kind?: QuestionKind, sectionId?: string | null, afterId?: string) => Promise<string | null>;
  patchQuestion: (id: string, patch: Partial<Pick<SurveyQuestion, "prompt_en" | "prompt_te" | "required">>) => void;
  setKind: (id: string, kind: QuestionKind) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  moveQuestion: (activeId: string, overId: string | null, toSection: string | null) => Promise<void>;
  ingest: (created: SurveyQuestion[]) => void;

  addSectionAt: (title?: string) => Promise<void>;
  patchSection: (id: string, patch: Partial<SurveySection>) => void;
  removeSection: (id: string) => Promise<void>;
  toggleCollapse: (id: string) => void;
  moveSection: (activeId: string, overId: string) => Promise<void>;

  addOptionTo: (qid: string) => Promise<void>;
  patchOption: (qid: string, oid: string, patch: { label_en?: string; label_te?: string }) => void;
  removeOption: (qid: string, oid: string) => Promise<void>;
  moveOption: (qid: string, oid: string, dir: -1 | 1) => Promise<void>;
}

// --- autosave plumbing -------------------------------------------------------
// Timers live outside the store so scheduling a write never triggers a render.
// Each entry keeps its writer fn so `flushAutosave` can run pending work early
// instead of discarding it.
interface Pending {
  timer: ReturnType<typeof setTimeout>;
  fn: () => Promise<void>;
}
const timers = new Map<string, Pending>();
let inFlight = 0;
const AUTOSAVE_MS = 400;

function beginSave() {
  inFlight++;
  useBuilderStore.setState({ saveState: "saving" });
}

function endSave(err?: unknown) {
  inFlight = Math.max(0, inFlight - 1);
  if (err) {
    console.error("[builder] autosave failed", err);
    useBuilderStore.setState({ saveState: "error" });
    toast.error("Could not save. Check your connection — your edit is still on screen.");
    return;
  }
  if (inFlight === 0) useBuilderStore.setState({ saveState: "saved" });
}

/** Debounce by key; the last write for a key wins. */
function debounce(key: string, fn: () => Promise<void>) {
  const existing = timers.get(key);
  if (existing) clearTimeout(existing.timer);
  useBuilderStore.setState({ saveState: "saving" });
  const run = async () => {
    timers.delete(key);
    beginSave();
    try {
      await fn();
      endSave();
    } catch (e) {
      endSave(e);
    }
  };
  timers.set(key, { timer: setTimeout(run, AUTOSAVE_MS), fn: run });
}

/** For immediate (non-debounced) writes — reorder, delete, add. */
async function immediate(fn: () => Promise<void>) {
  beginSave();
  try {
    await fn();
    endSave();
  } catch (e) {
    endSave(e);
  }
}

/**
 * Run every pending debounced write immediately and wait for it. Called before
 * publish and on unmount so navigating away mid-keystroke never loses an edit.
 */
export async function flushAutosave() {
  const pending = [...timers.values()];
  pending.forEach((p) => clearTimeout(p.timer));
  await Promise.all(pending.map((p) => p.fn()));
}

export const hasPendingWrites = () => timers.size > 0 || inFlight > 0;

// --- store -------------------------------------------------------------------

export const useBuilderStore = create<BuilderState>((set, get) => ({
  survey: null,
  byId: {},
  order: [],
  sections: [],
  loading: true,
  saveState: "idle",
  search: "",
  kindFilter: "all",
  requiredFilter: "all",
  focusedId: null,

  async load(surveyId) {
    set({ loading: true });
    const data = await getSurveyWithQuestions(surveyId);
    if (!data) {
      set({ loading: false, survey: null });
      return;
    }
    const byId: Record<string, SurveyQuestion> = {};
    for (const q of data.questions) byId[q.id] = q;
    set({
      survey: data.survey,
      byId,
      order: data.questions.map((q) => q.id),
      sections: data.sections,
      loading: false,
      saveState: "idle",
    });
  },

  reset() {
    timers.forEach((p) => clearTimeout(p.timer));
    timers.clear();
    inFlight = 0;
    set({ survey: null, byId: {}, order: [], sections: [], loading: true, saveState: "idle", search: "", kindFilter: "all", requiredFilter: "all", focusedId: null });
  },

  setSearch: (search) => set({ search }),
  setKindFilter: (kindFilter) => set({ kindFilter }),
  setRequiredFilter: (requiredFilter) => set({ requiredFilter }),
  setFocused: (focusedId) => set({ focusedId }),

  setMeta(patch) {
    const survey = get().survey;
    if (!survey) return;
    set({ survey: { ...survey, ...patch } });
    debounce(`meta:${survey.id}`, () => updateSurveyMeta(survey.id, patch));
  },

  setSurveyStatus(patch) {
    const survey = get().survey;
    if (!survey) return;
    set({ survey: { ...survey, ...patch } });
  },

  async addQuestion(kind = "short_text", sectionId = null, afterId) {
    const survey = get().survey;
    if (!survey) return null;

    // A new question has an empty prompt, so an active search would hide it the
    // instant it's created and the click would look like it did nothing.
    if (selectFiltering(get())) set({ search: "", kindFilter: "all", requiredFilter: "all" });

    const { order } = get();

    // Insert position: right after `afterId` when duplicating//adding inline,
    // otherwise at the end of the target section.
    let insertAt = order.length;
    if (afterId) {
      const i = order.indexOf(afterId);
      if (i !== -1) insertAt = i + 1;
    }

    let created: SurveyQuestion;
    try {
      beginSave();
      created = await createQuestion(survey.id, kind, { section_id: sectionId, order_index: insertAt });
    } catch (e) {
      endSave(e);
      return null;
    }

    const nextOrder = [...order];
    nextOrder.splice(insertAt, 0, created.id);
    set((s) => ({ byId: { ...s.byId, [created.id]: created }, order: nextOrder, focusedId: created.id }));

    // Positions after the insert shifted — persist the whole list once.
    try {
      await reorderQuestions(nextOrder.map((id) => ({ id, section_id: get().byId[id]?.section_id ?? null })));
      endSave();
    } catch (e) {
      endSave(e);
    }
    return created.id;
  },

  patchQuestion(id, patch) {
    const q = get().byId[id];
    if (!q) return;
    set((s) => ({ byId: { ...s.byId, [id]: { ...s.byId[id], ...patch } } }));
    debounce(`q:${id}`, () => updateQuestion(id, patch));
  },

  async setKind(id, kind) {
    const q = get().byId[id];
    if (!q) return;
    set((s) => ({ byId: { ...s.byId, [id]: { ...s.byId[id], kind } } }));
    await immediate(async () => {
      await updateQuestion(id, { kind });
      const meta = QUESTION_KINDS.find((k) => k.value === kind);
      // Switching into an option-based kind with no options yet: seed two.
      if (meta?.hasOptions && get().byId[id]?.options.length === 0) {
        const [o1, o2] = await Promise.all([addOption(id, 0), addOption(id, 1)]);
        set((s) => ({ byId: { ...s.byId, [id]: { ...s.byId[id], options: [o1, o2] } } }));
      }
    });
  },

  async duplicate(id) {
    const q = get().byId[id];
    if (!q) return;
    let copy: SurveyQuestion;
    try {
      beginSave();
      copy = await duplicateQuestion(q);
    } catch (e) {
      endSave(e);
      return;
    }
    const order = [...get().order];
    const at = order.indexOf(id) + 1;
    order.splice(at, 0, copy.id);
    set((s) => ({ byId: { ...s.byId, [copy.id]: copy }, order, focusedId: copy.id }));
    try {
      await reorderQuestions(order.map((qid) => ({ id: qid, section_id: get().byId[qid]?.section_id ?? null })));
      endSave();
    } catch (e) {
      endSave(e);
    }
  },

  async remove(id) {
    const snapshotById = get().byId;
    const snapshotOrder = get().order;
    const next = { ...snapshotById };
    delete next[id];
    set({ byId: next, order: snapshotOrder.filter((x) => x !== id) });
    // Drop any queued edit for a question we're deleting.
    const t = timers.get(`q:${id}`);
    if (t) {
      clearTimeout(t.timer);
      timers.delete(`q:${id}`);
    }
    try {
      beginSave();
      await deleteQuestion(id);
      endSave();
    } catch (e) {
      // Put it back — a failed delete must not silently vanish the question.
      set({ byId: snapshotById, order: snapshotOrder });
      endSave(e);
    }
  },

  async moveQuestion(activeId, overId, toSection) {
    const order = [...get().order];
    const from = order.indexOf(activeId);
    if (from === -1) return;
    order.splice(from, 1);
    const to = overId ? order.indexOf(overId) : order.length;
    order.splice(to === -1 ? order.length : to, 0, activeId);

    set((s) => ({
      order,
      byId: { ...s.byId, [activeId]: { ...s.byId[activeId], section_id: toSection } },
    }));
    await immediate(() =>
      reorderQuestions(order.map((id) => ({ id, section_id: get().byId[id]?.section_id ?? null }))),
    );
  },

  ingest(created) {
    if (!created.length) return;
    set((s) => {
      const byId = { ...s.byId };
      for (const q of created) byId[q.id] = q;
      return { byId, order: [...s.order, ...created.map((q) => q.id)] };
    });
  },

  async addSectionAt(title) {
    const survey = get().survey;
    if (!survey) return;
    const sections = get().sections;
    try {
      beginSave();
      const s = await createSection(survey.id, sections.length, title);
      set({ sections: [...sections, s] });
      endSave();
    } catch (e) {
      endSave(e);
    }
  },

  patchSection(id, patch) {
    set((s) => ({ sections: s.sections.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    debounce(`sec:${id}`, () => updateSection(id, patch));
  },

  async removeSection(id) {
    // Questions survive: the FK is ON DELETE SET NULL, so they fall back to Ungrouped.
    set((s) => {
      const byId = { ...s.byId };
      for (const qid of s.order) {
        if (byId[qid]?.section_id === id) byId[qid] = { ...byId[qid], section_id: null };
      }
      return { sections: s.sections.filter((x) => x.id !== id), byId };
    });
    await immediate(() => deleteSection(id));
  },

  toggleCollapse(id) {
    const sec = get().sections.find((s) => s.id === id);
    if (!sec) return;
    get().patchSection(id, { collapsed: !sec.collapsed });
  },

  async moveSection(activeId, overId) {
    const ids = get().sections.map((s) => s.id);
    const from = ids.indexOf(activeId);
    const to = ids.indexOf(overId);
    if (from === -1 || to === -1) return;
    ids.splice(from, 1);
    ids.splice(to, 0, activeId);
    const map = new Map(get().sections.map((s) => [s.id, s]));
    set({ sections: ids.map((id, i) => ({ ...map.get(id)!, order_index: i })) });
    await immediate(() => reorderSections(ids));
  },

  async addOptionTo(qid) {
    const q = get().byId[qid];
    if (!q) return;
    try {
      beginSave();
      const o = await addOption(qid, q.options.length);
      set((s) => ({ byId: { ...s.byId, [qid]: { ...s.byId[qid], options: [...s.byId[qid].options, o] } } }));
      endSave();
    } catch (e) {
      endSave(e);
    }
  },

  patchOption(qid, oid, patch) {
    set((s) => ({
      byId: {
        ...s.byId,
        [qid]: { ...s.byId[qid], options: s.byId[qid].options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) },
      },
    }));
    debounce(`o:${oid}`, () => updateOption(oid, patch));
  },

  async removeOption(qid, oid) {
    set((s) => ({
      byId: { ...s.byId, [qid]: { ...s.byId[qid], options: s.byId[qid].options.filter((o) => o.id !== oid) } },
    }));
    await immediate(() => deleteOption(oid));
  },

  async moveOption(qid, oid, dir) {
    const q = get().byId[qid];
    if (!q) return;
    const idx = q.options.findIndex((o) => o.id === oid);
    const swap = idx + dir;
    if (swap < 0 || swap >= q.options.length) return;
    const next = [...q.options];
    [next[idx], next[swap]] = [next[swap], next[idx]];
    set((s) => ({ byId: { ...s.byId, [qid]: { ...s.byId[qid], options: next } } }));
    await immediate(() => reorderOptions(next.map((o) => o.id)));
  },
}));

// --- selectors ---------------------------------------------------------------

/** A row subscribes to exactly its own question object. */
export const useQuestion = (id: string) => useBuilderStore((s) => s.byId[id]);

/** True when any filter is narrowing the list — drives the "clear filters" affordance. */
export const selectFiltering = (s: BuilderState) =>
  s.search.trim() !== "" || s.kindFilter !== "all" || s.requiredFilter !== "all";

/**
 * Ids passing the current search/filter, in order. Runs on every store change
 * (cheap string work) but callers pair it with `useShallow`, so a component
 * only re-renders when the resulting membership actually changes — typing in a
 * question does not re-render the list.
 */
export function selectVisibleIds(s: BuilderState): string[] {
  const q = s.search.trim().toLowerCase();
  const out: string[] = [];
  for (const id of s.order) {
    const item = s.byId[id];
    if (!item) continue;
    if (s.kindFilter !== "all" && item.kind !== s.kindFilter) continue;
    if (s.requiredFilter === "required" && !item.required) continue;
    if (s.requiredFilter === "optional" && item.required) continue;
    if (q) {
      const hay = `${item.prompt_en} ${item.prompt_te ?? ""}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    out.push(id);
  }
  return out;
}
