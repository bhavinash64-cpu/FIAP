import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Eye, SearchX } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { getSurveyWithQuestions } from "@/lib/surveys";

export default function SurveyPreview() {
  const { id } = useParams();
  const { data, isError } = useQuery({ queryKey: ["survey-detail", id], queryFn: () => getSurveyWithQuestions(id!), enabled: !!id });
  const survey = data?.survey ?? null;
  const questions = data?.questions ?? null;

  // Deleted / invalid survey, or a failed load — an explicit state, not a spinner.
  if (isError || data === null) {
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <SearchX className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 t-section">Survey not found</h1>
          <p className="mx-auto mt-2 max-w-xs t-body text-muted-foreground">This survey couldn't be loaded — it may have been deleted.</p>
          <Button asChild variant="outline" className="mt-6"><Link to="/app/surveys"><ArrowLeft strokeWidth={1.5} />Back to surveys</Link></Button>
        </div>
      </div>
    );
  }

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
