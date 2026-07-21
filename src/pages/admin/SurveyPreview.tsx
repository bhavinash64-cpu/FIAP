import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { getSurveyWithQuestions, type Survey, type SurveyQuestion } from "@/lib/surveys";

export default function SurveyPreview() {
  const { id } = useParams();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [questions, setQuestions] = useState<SurveyQuestion[] | null>(null);

  useEffect(() => {
    if (!id) return;
    getSurveyWithQuestions(id).then((data) => {
      if (!data) return;
      setSurvey(data.survey);
      setQuestions(data.questions);
    });
  }, [id]);

  if (!survey || !questions) {
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} /></div>;
  }

  return (
    <SurveyForm
      survey={survey}
      questions={questions}
      submitting={false}
      onSubmit={() => { toast.info("This is a preview — nothing is submitted."); }}
      banner={
        <div className="border-b border-warning/20 bg-warning/10">
          <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2 sm:px-6 t-caption text-warning">
            <Eye className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} /> Preview mode — this is exactly what a respondent will see. Nothing is saved.
            <Link to={`/app/surveys/${survey.id}/edit`} className="ml-auto inline-flex shrink-0 items-center gap-1 underline underline-offset-2">
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} />Back to editor
            </Link>
          </div>
        </div>
      }
    />
  );
}
