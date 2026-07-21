import { Profiler } from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup, fireEvent } from "@testing-library/react";
import type { SurveyQuestion, SurveySection, Survey } from "@/lib/surveys";

// The store calls straight into the data layer; stub it so these tests exercise
// the React/state behaviour without touching Supabase.
vi.mock("@/lib/surveys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/surveys")>();
  return {
    ...actual,
    updateQuestion: vi.fn().mockResolvedValue(undefined),
    updateOption: vi.fn().mockResolvedValue(undefined),
    updateSurveyMeta: vi.fn().mockResolvedValue(undefined),
    reorderQuestions: vi.fn().mockResolvedValue(undefined),
    getSurveyWithQuestions: vi.fn(),
  };
});

import { useBuilderStore, selectVisibleIds } from "@/stores/builderStore";
import { QuestionRow } from "@/components/survey/builder/QuestionRow";

const survey: Survey = {
  id: "s1",
  title_en: "Test",
  title_te: null,
  description_en: null,
  description_te: null,
  status: "draft",
  slug: null,
  created_at: "",
  updated_at: "",
  published_at: null,
};

function makeQ(id: string, prompt: string, over: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return {
    id,
    survey_id: "s1",
    order_index: 0,
    kind: "short_text",
    prompt_en: prompt,
    prompt_te: null,
    required: true,
    origin: "manual",
    source_ref: null,
    section_id: null,
    options: [],
    ...over,
  };
}

function seed(questions: SurveyQuestion[], sections: SurveySection[] = []) {
  const byId: Record<string, SurveyQuestion> = {};
  for (const q of questions) byId[q.id] = q;
  useBuilderStore.setState({
    survey,
    byId,
    order: questions.map((q) => q.id),
    sections,
    loading: false,
    saveState: "idle",
    search: "",
    kindFilter: "all",
    requiredFilter: "all",
  });
}

afterEach(() => {
  cleanup();
  useBuilderStore.getState().reset();
  vi.clearAllMocks();
});

describe("builder store: filtering", () => {
  beforeEach(() =>
    seed([
      makeQ("a", "How is your family?"),
      makeQ("b", "Rate your sleep", { kind: "rating5" }),
      makeQ("c", "Optional note", { required: false, kind: "long_text" }),
    ]),
  );

  it("matches search against English and Telugu prompts", () => {
    useBuilderStore.setState({ search: "sleep" });
    expect(selectVisibleIds(useBuilderStore.getState())).toEqual(["b"]);

    useBuilderStore.setState({ byId: { ...useBuilderStore.getState().byId, a: makeQ("a", "How is your family?", { prompt_te: "నిద్ర" }) }, search: "నిద్ర" });
    expect(selectVisibleIds(useBuilderStore.getState())).toEqual(["a"]);
  });

  it("filters by kind and by required", () => {
    useBuilderStore.setState({ kindFilter: "rating5" });
    expect(selectVisibleIds(useBuilderStore.getState())).toEqual(["b"]);

    useBuilderStore.setState({ kindFilter: "all", requiredFilter: "optional" });
    expect(selectVisibleIds(useBuilderStore.getState())).toEqual(["c"]);
  });

  it("search is case-insensitive and combines with filters", () => {
    useBuilderStore.setState({ search: "RATE", kindFilter: "rating5" });
    expect(selectVisibleIds(useBuilderStore.getState())).toEqual(["b"]);

    useBuilderStore.setState({ search: "RATE", kindFilter: "short_text" });
    expect(selectVisibleIds(useBuilderStore.getState())).toEqual([]);
  });
});

describe("builder store: editing", () => {
  it("patchQuestion updates optimistically and debounces the write", async () => {
    vi.useFakeTimers();
    seed([makeQ("a", "")]);
    const { updateQuestion } = await import("@/lib/surveys");

    act(() => {
      useBuilderStore.getState().patchQuestion("a", { prompt_en: "H" });
      useBuilderStore.getState().patchQuestion("a", { prompt_en: "Hi" });
      useBuilderStore.getState().patchQuestion("a", { prompt_en: "Hi!" });
    });

    // Optimistic: latest text is on screen immediately.
    expect(useBuilderStore.getState().byId.a.prompt_en).toBe("Hi!");
    expect(useBuilderStore.getState().saveState).toBe("saving");
    // Debounced: three keystrokes collapse into one network write.
    expect(updateQuestion).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(updateQuestion).toHaveBeenCalledTimes(1);
    expect(updateQuestion).toHaveBeenCalledWith("a", { prompt_en: "Hi!" });
    expect(useBuilderStore.getState().saveState).toBe("saved");
    vi.useRealTimers();
  });

  it("clears active filters when adding, so the new question isn't hidden", async () => {
    seed([makeQ("a", "Existing")]);
    const surveys = await import("@/lib/surveys");
    vi.spyOn(surveys, "createQuestion").mockResolvedValueOnce(makeQ("new", ""));
    useBuilderStore.setState({ search: "Existing", kindFilter: "rating5" });

    await act(async () => {
      await useBuilderStore.getState().addQuestion();
    });

    expect(useBuilderStore.getState().search).toBe("");
    expect(useBuilderStore.getState().kindFilter).toBe("all");
    // The empty new question is visible rather than filtered out of existence.
    expect(selectVisibleIds(useBuilderStore.getState())).toContain("new");
  });

  it("restores the question when a delete fails, instead of losing it", async () => {
    seed([makeQ("a", "Keep me")]);
    const surveys = await import("@/lib/surveys");
    vi.spyOn(surveys, "deleteQuestion").mockRejectedValueOnce(new Error("offline"));

    await act(async () => {
      await useBuilderStore.getState().remove("a");
    });

    expect(useBuilderStore.getState().order).toEqual(["a"]);
    expect(useBuilderStore.getState().byId.a.prompt_en).toBe("Keep me");
    expect(useBuilderStore.getState().saveState).toBe("error");
  });
});

describe("QuestionRow re-render isolation", () => {
  it("typing in one question does not re-render the others", async () => {
    seed([makeQ("a", "First"), makeQ("b", "Second"), makeQ("c", "Third")]);

    // Profiler counts renders of the QuestionRow subtree itself. A row that is
    // properly isolated simply never commits, so its callback never fires.
    const renders: Record<string, number> = { a: 0, b: 0, c: 0 };
    const count = (id: string) => () => {
      renders[id]++;
    };

    render(
      <>
        <Profiler id="a" onRender={count("a")}>
          <QuestionRow id="a" index={0} />
        </Profiler>
        <Profiler id="b" onRender={count("b")}>
          <QuestionRow id="b" index={1} />
        </Profiler>
        <Profiler id="c" onRender={count("c")}>
          <QuestionRow id="c" index={2} />
        </Profiler>
      </>,
    );

    const baseline = { ...renders };
    const first = screen.getByLabelText("Question 1, English");

    // Three keystrokes into question "a".
    for (const text of ["FirstX", "FirstXY", "FirstXYZ"]) {
      fireEvent.change(first, { target: { value: text } });
    }

    // The edited row re-rendered...
    expect(renders.a).toBeGreaterThan(baseline.a);
    // ...and its neighbours did not render at all. This is the whole point:
    // before the store rewrite, every keystroke re-rendered all 132 rows.
    expect(renders.b).toBe(baseline.b);
    expect(renders.c).toBe(baseline.c);
    expect(useBuilderStore.getState().byId.a.prompt_en).toBe("FirstXYZ");
  });

  it("backspace on an empty prompt does not delete a question that has options", () => {
    seed([
      makeQ("a", "", {
        kind: "multiple_choice",
        options: [
          { id: "o1", question_id: "a", order_index: 0, label_en: "Yes", label_te: null },
          { id: "o2", question_id: "a", order_index: 1, label_en: "No", label_te: null },
        ],
      }),
    ]);
    render(<QuestionRow id="a" index={0} />);

    fireEvent.keyDown(screen.getByLabelText("Question 1, English"), { key: "Backspace" });

    // Authored options are real work — a stray keystroke must not discard them.
    expect(useBuilderStore.getState().order).toEqual(["a"]);
  });

  it("backspace on a fully empty question removes it", async () => {
    seed([makeQ("a", "")]);
    const surveys = await import("@/lib/surveys");
    vi.spyOn(surveys, "deleteQuestion").mockResolvedValue(undefined);
    render(<QuestionRow id="a" index={0} />);

    await act(async () => {
      fireEvent.keyDown(screen.getByLabelText("Question 1, English"), { key: "Backspace" });
    });

    expect(useBuilderStore.getState().order).toEqual([]);
  });
});
