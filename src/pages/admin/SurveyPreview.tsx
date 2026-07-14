import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye } from "lucide-react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { getSurveyWithQuestions, type Survey, type SurveyQuestion } from "@/lib/surveys";
import { useLang } from "@/lib/i18n";
import { useI18nStore } from "@/lib/i18n";

export default function SurveyPreview() {
  const { id } = useParams();
  const lang = useLang();
  const setLang = useI18nStore((s) => s.setLang);
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
    return <div className="min-h-dvh grid place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <SurveyForm
      survey={survey}
      questions={questions}
      lang={lang}
      onLangChange={setLang}
      submitting={false}
      onSubmit={() => { toast.info("This is a preview — nothing is submitted."); }}
      banner={
        <div className="bg-warning/15 border-b border-warning/30 text-warning-foreground">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 py-2 flex items-center gap-2 text-xs font-medium text-warning">
            <Eye className="h-3.5 w-3.5" /> Preview mode — this is exactly what a respondent will see. Nothing is saved.
            <Link to={`/app/surveys/${survey.id}/edit`} className="ml-auto inline-flex items-center gap-1 underline"><ArrowLeft className="h-3 w-3" />Back to editor</Link>
          </div>
        </div>
      }
    />
  );
}
