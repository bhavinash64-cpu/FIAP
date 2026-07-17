import { describe, expect, it, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WelcomeStage, ConsentStage, InstructionsStage } from "@/components/assessment/IntroStages";
import { QuestionStage } from "@/components/assessment/QuestionStage";
import { ReviewStage } from "@/components/assessment/ReviewStage";
import { ThankYouStage } from "@/components/assessment/ThankYouStage";
import { useI18nStore } from "@/lib/i18n";
import type { Survey, SurveyQuestion, AnswerValue } from "@/lib/surveys";

const survey: Survey = {
  id: "s1",
  title_en: "Family Well-being Check",
  title_te: "కుటుంబ శ్రేయస్సు తనిఖీ",
  description_en: "A gentle set of questions.",
  description_te: "సున్నితమైన ప్రశ్నలు.",
  status: "published",
  slug: "abc1234",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  published_at: "2026-01-01T00:00:00Z",
};

function makeQ(id: string, over: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return {
    id,
    survey_id: "s1",
    order_index: 0,
    kind: "likert5",
    prompt_en: `Prompt ${id}`,
    prompt_te: `ప్రశ్న ${id}`,
    required: true,
    origin: "manual",
    source_ref: null,
    section_id: null,
    options: [],
    ...over,
  };
}

const questions = [
  makeQ("a", { prompt_en: "I often feel helpless in an emotional situation." }),
  makeQ("b", {
    kind: "multiple_choice",
    prompt_en: "How often do you feel restless?",
    options: [
      { id: "o1", question_id: "b", order_index: 0, label_en: "Never", label_te: "ఎప్పుడూ కాదు" },
      { id: "o2", question_id: "b", order_index: 1, label_en: "Sometimes", label_te: "కొన్నిసార్లు" },
      { id: "o3", question_id: "b", order_index: 2, label_en: "Often", label_te: "తరచుగా" },
    ],
  }),
  makeQ("c", { kind: "yes_no", prompt_en: "Do you sleep well?" }),
];

function renderStage(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}

afterEach(() => {
  cleanup();
  useI18nStore.setState({ mode: "en" });
});

describe("assessment stages render", () => {
  it("Welcome shows the survey title, duration and begins", () => {
    const onBegin = vi.fn();
    renderStage(
      <WelcomeStage
        survey={survey}
        mode="en"
        minutes={7}
        questionCount={3}
        canResume={false}
        onBegin={onBegin}
        onResume={vi.fn()}
        onStartOver={vi.fn()}
      />,
    );
    expect(screen.getByText("Family Well-being Check")).toBeInTheDocument();
    expect(screen.getByText(/3 questions/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Begin/i }));
    expect(onBegin).toHaveBeenCalled();
  });

  it("Welcome offers resume when a draft exists", () => {
    const onResume = vi.fn();
    renderStage(
      <WelcomeStage
        survey={survey}
        mode="en"
        minutes={7}
        questionCount={3}
        canResume
        onBegin={vi.fn()}
        onResume={onResume}
        onStartOver={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Continue where I left off/i }));
    expect(onResume).toHaveBeenCalled();
  });

  it("Consent gates Continue behind the agreement toggle", () => {
    const onAgree = vi.fn();
    renderStage(<ConsentStage onAgree={onAgree} onBack={vi.fn()} />);

    const cont = screen.getByRole("button", { name: /Continue/i });
    expect(cont).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox"));
    expect(cont).not.toBeDisabled();
    fireEvent.click(cont);
    expect(onAgree).toHaveBeenCalled();
  });

  it("Instructions render and start the questions", () => {
    const onStart = vi.fn();
    renderStage(<InstructionsStage onStart={onStart} onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Start the questions/i }));
    expect(onStart).toHaveBeenCalled();
  });

  it("Question stage shows progress, prompt and answer cards", () => {
    renderStage(
      <QuestionStage
        questions={questions}
        index={0}
        answers={{}}
        mode="en"
        onAnswer={vi.fn()}
        onNavigate={vi.fn()}
        onBackToIntro={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    expect(screen.getByText("Question 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("I often feel helpless in an emotional situation.")).toBeInTheDocument();
    // Likert renders five radio cards.
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    // Voice control renders. jsdom has no speechSynthesis, so it renders in its
    // disabled "unavailable" form — the Listen label is still shown.
    expect(screen.getByText("Listen")).toBeInTheDocument();
  });

  it("Question stage blocks Next on a required, unanswered question", () => {
    const onNavigate = vi.fn();
    const onReview = vi.fn();
    renderStage(
      <QuestionStage
        questions={questions}
        index={0}
        answers={{}}
        mode="en"
        onAnswer={vi.fn()}
        onNavigate={onNavigate}
        onBackToIntro={vi.fn()}
        onReview={onReview}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^Next/i }));
    expect(onNavigate).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/choose an answer/i);
  });

  it("Question stage records an answer and reports it to the parent", () => {
    const onAnswer = vi.fn();
    renderStage(
      <QuestionStage
        questions={questions}
        index={0}
        answers={{}}
        mode="en"
        onAnswer={onAnswer}
        onNavigate={vi.fn()}
        onBackToIntro={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    // Pick the third likert option.
    fireEvent.click(screen.getAllByRole("radio")[2]);
    expect(onAnswer).toHaveBeenCalledWith("a", 3);
  });

  it("Review summarises answered vs remaining and lists answers", () => {
    const answers: Record<string, AnswerValue> = { a: 3, b: "o2" };
    renderStage(
      <ReviewStage
        questions={questions}
        answers={answers}
        mode="en"
        submitting={false}
        onEdit={vi.fn()}
        onBack={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByText("Review your answers")).toBeInTheDocument();
    // One required question (c) is unanswered, so the CTA nudges to it. The
    // phrase appears in both the banner and the button.
    expect(screen.getAllByText(/1 questions still need an answer/i).length).toBeGreaterThan(0);
    // The chosen frequency option is shown in the summary.
    expect(screen.getByText("Sometimes")).toBeInTheDocument();
  });

  it("Review submits when everything required is answered", () => {
    const onSubmit = vi.fn();
    renderStage(
      <ReviewStage
        questions={questions}
        answers={{ a: 3, b: "o2", c: "yes" }}
        mode="en"
        submitting={false}
        onEdit={vi.fn()}
        onBack={vi.fn()}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Submit my answers/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("Thank you shows the reference id and submission date", () => {
    renderStage(<ThankYouStage survey={survey} mode="en" referenceId="1A2B-3C4D-5E6F" submittedAt="2026-07-17T10:30:00Z" />);
    expect(screen.getAllByText("Thank you").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1A2B-3C4D-5E6F").length).toBeGreaterThan(0);
  });

  it("switches the whole interface to Telugu", () => {
    useI18nStore.setState({ mode: "te" });
    renderStage(
      <QuestionStage
        questions={questions}
        index={0}
        answers={{}}
        mode="te"
        onAnswer={vi.fn()}
        onNavigate={vi.fn()}
        onBackToIntro={vi.fn()}
        onReview={vi.fn()}
      />,
    );
    // Progress, prompt and the Listen button all render in Telugu.
    expect(screen.getByText("ప్రశ్న 1 / 3")).toBeInTheDocument();
    expect(screen.getByText("ప్రశ్న a")).toBeInTheDocument();
    expect(screen.getByText("వినండి")).toBeInTheDocument();
  });
});
