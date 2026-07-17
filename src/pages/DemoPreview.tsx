import { useState } from "react";
import { Link } from "react-router-dom";
import { Shield, FileQuestion, Users, CalendarDays, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/survey/StatusBadge";
import { SortableQuestionList } from "@/components/survey/SortableQuestionList";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { LangToggle } from "@/components/LangToggle";
import type { QuestionKind, SurveyQuestion } from "@/lib/surveys";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Pure front-end demo — no Supabase, no auth, no network calls. Everything
// here is in-memory only so it can be viewed the instant the dev server is
// up, independent of whether the database/auth setup has finished.
// ---------------------------------------------------------------------------

let idCounter = 1;
const nextId = () => `demo-${idCounter++}`;

function makeQuestion(kind: QuestionKind, prompt_en: string, options: string[] = []): SurveyQuestion {
  return {
    id: nextId(),
    survey_id: "demo-survey",
    order_index: 0,
    kind,
    prompt_en,
    prompt_te: null,
    required: true,
    origin: "manual",
    source_ref: null,
    section_id: null,
    options: options.map((label_en, i) => ({ id: nextId(), question_id: "demo", order_index: i, label_en, label_te: null })),
  };
}

const INITIAL_QUESTIONS: SurveyQuestion[] = [
  makeQuestion("multiple_choice", "How would you rate your family's overall well-being this month?", ["Excellent", "Good", "Fair", "Poor"]),
  makeQuestion("likert5", "I feel supported by my family when I face difficulties."),
  makeQuestion("checkboxes", "Which of the following describe your household? (select all that apply)", ["Joint family", "Nuclear family", "Single parent", "Elderly dependents", "Children under 12"]),
  makeQuestion("rating5", "How would you rate your access to community support services?"),
  makeQuestion("yes_no", "Have you or a family member sought counselling in the past year?"),
  makeQuestion("long_text", "Is there anything else you'd like to share about your family's situation?"),
];

const MOCK_SURVEYS = [
  { title: "Family Well-being Check-in — Q3 2026", status: "published" as const, questions: 12, responses: 248 },
  { title: "Community Policing Feedback", status: "draft" as const, questions: 6, responses: 0 },
  { title: "Youth Digital Safety Survey", status: "closed" as const, questions: 9, responses: 573 },
];

export default function DemoPreview() {
  const [questions, setQuestions] = useState<SurveyQuestion[]>(INITIAL_QUESTIONS);

  function handleReorder(orderedIds: string[]) {
    const map = new Map(questions.map((q) => [q.id, q]));
    setQuestions(orderedIds.map((id) => map.get(id)!));
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-warning/15 border-b border-warning/30">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2.5 flex items-center gap-2 text-xs font-medium text-warning">
          <Sparkles className="h-3.5 w-3.5" />
          Demo preview — fake data, nothing saved, no login or database required. Once Supabase is connected, this becomes the real admin console at /app.
        </div>
      </div>

      <header className="border-b border-border/60 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl brand-gradient grid place-items-center shadow-md">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">APFAP</div>
              <div className="t-caption text-muted-foreground">AP Police</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle />
            <Badge variant="secondary" className="rounded-lg">Demo</Badge>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8">
        <Tabs defaultValue="surveys">
          <TabsList className="rounded-xl">
            <TabsTrigger value="surveys" className="rounded-lg">Surveys</TabsTrigger>
            <TabsTrigger value="builder" className="rounded-lg">Survey builder</TabsTrigger>
            <TabsTrigger value="public" className="rounded-lg">Parent view</TabsTrigger>
          </TabsList>

          <TabsContent value="surveys" className="mt-6">
            <h1 className="text-2xl font-semibold tracking-tight mb-4">Your surveys</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {MOCK_SURVEYS.map((s) => (
                <Card key={s.title} className="rounded-2xl border-border/70 hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <StatusBadge status={s.status} />
                    <div className="mt-3 font-semibold leading-snug">{s.title}</div>
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" />{s.questions} questions</span>
                      <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{s.responses} responses</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1 t-caption text-muted-foreground">
                      <CalendarDays className="h-3 w-3" /> Created 3 days ago
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="builder" className="mt-6 max-w-3xl">
            <h1 className="text-2xl font-semibold tracking-tight mb-1">Family Well-being Check-in — Q3 2026</h1>
            <p className="text-sm text-muted-foreground mb-5">Drag to reorder, switch question types, edit text — all live, nothing persisted.</p>
            <SortableQuestionList
              questions={questions}
              onReorder={handleReorder}
              onChangeField={(id, patch) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...patch } : q)))}
              onChangeKind={(id, kind) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, kind } : q)))}
              onDelete={(id) => setQuestions((qs) => qs.filter((q) => q.id !== id))}
              onDuplicate={(id) => setQuestions((qs) => {
                const q = qs.find((x) => x.id === id);
                return q ? [...qs, { ...q, id: nextId() }] : qs;
              })}
              onAddOption={(id) => setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, options: [...q.options, { id: nextId(), question_id: id, order_index: q.options.length, label_en: `Option ${q.options.length + 1}`, label_te: null }] } : q)))}
              onUpdateOption={(qid, oid, patch) => setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) } : q)))}
              onDeleteOption={(qid, oid) => setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, options: q.options.filter((o) => o.id !== oid) } : q)))}
              onMoveOption={(qid, oid, dir) => setQuestions((qs) => qs.map((q) => {
                if (q.id !== qid) return q;
                const idx = q.options.findIndex((o) => o.id === oid);
                const swap = idx + dir;
                if (swap < 0 || swap >= q.options.length) return q;
                const next = [...q.options];
                [next[idx], next[swap]] = [next[swap], next[idx]];
                return { ...q, options: next };
              }))}
            />
          </TabsContent>

          <TabsContent value="public" className="mt-6">
            <div className="rounded-2xl border border-border/70 overflow-hidden max-w-2xl mx-auto">
              <SurveyForm
                survey={{
                  id: "demo-survey", title_en: "Family Well-being Check-in — Q3 2026", title_te: null,
                  description_en: "A short, confidential survey to help us understand family well-being in your community.",
                  description_te: null, status: "published", slug: "demo", created_at: "", updated_at: "", published_at: "",
                }}
                questions={questions}
                submitting={false}
                onSubmit={() => { toast.info("Demo only — nothing is submitted."); }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <div className="text-center py-6">
        <Button asChild variant="ghost" size="sm"><Link to="/">← Back to landing page</Link></Button>
      </div>
    </div>
  );
}
