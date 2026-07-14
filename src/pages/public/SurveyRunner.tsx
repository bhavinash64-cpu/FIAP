import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Shield, CheckCircle2, Lock, SearchX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { getPublicSurvey, submitSurveyResponse, trackSurveyView, type AnswerValue, type PublicSurveyState } from "@/lib/surveys";
import { useI18nStore, useLang } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";

export default function SurveyRunner() {
  const { slug } = useParams();
  const lang = useLang();
  const setLang = useI18nStore((s) => s.setLang);
  const [state, setState] = useState<PublicSurveyState | "loading" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitLock = useRef(false);
  const viewTracked = useRef(false);
  const startedAt = useRef<Date | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    getPublicSurvey(slug)
      .then((s) => { if (!cancelled) setState(s); })
      .catch(() => { if (!cancelled) setState("error"); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (typeof state !== "string" && state.kind === "open" && !viewTracked.current) {
      viewTracked.current = true;
      startedAt.current = new Date();
      trackSurveyView(state.survey.id);
    }
  }, [state]);

  async function handleSubmit(answers: Record<string, AnswerValue>) {
    if (submitLock.current || state === "loading" || state === "error" || state.kind !== "open") return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await submitSurveyResponse(state.survey.id, lang, answers, startedAt.current ?? undefined);
      setSubmitted(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't submit right now. Please check your connection and try again.");
      submitLock.current = false;
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "loading") {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "error") {
    return (
      <StatusScreen icon={SearchX} title="Something went wrong" body="Please check your connection and reload this page." />
    );
  }

  if (state.kind === "not_found") {
    return (
      <StatusScreen icon={SearchX} title="Survey not found" body="This link doesn't match any survey. Please check the link and try again." />
    );
  }

  if (state.kind === "closed") {
    const title = lang === "te" && state.survey.title_te ? state.survey.title_te : state.survey.title_en;
    return (
      <StatusScreen icon={Lock} title="This survey is closed" body={`"${title}" is no longer accepting responses. Thank you for your interest.`} />
    );
  }

  if (submitted) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background px-6">
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: "easeOut" }} className="text-center max-w-sm">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            className="mx-auto h-16 w-16 rounded-full bg-success/15 grid place-items-center"
          >
            <CheckCircle2 className="h-9 w-9 text-success" />
          </motion.div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">{lang === "te" ? "ధన్యవాదాలు!" : "Thank you!"}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {lang === "te" ? "మీ సమాధానం విజయవంతంగా సమర్పించబడింది." : "Your response has been submitted successfully."}
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <SurveyForm
      survey={state.survey}
      questions={state.questions}
      lang={lang}
      onLangChange={setLang}
      onSubmit={handleSubmit}
      submitting={submitting}
    />
  );
}

function StatusScreen({ icon: Icon, title, body }: { icon: typeof SearchX; title: string; body: string }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="border-b border-border/60 bg-white/90">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 h-14 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg brand-gradient grid place-items-center shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="text-xs font-semibold text-muted-foreground">AP Police Family Assessment Platform</div>
          <div className="ml-auto"><LangToggle size="sm" /></div>
        </div>
      </header>
      <div className="flex-1 grid place-items-center px-6">
        <div className="text-center max-w-sm">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-muted grid place-items-center">
            <Icon className="h-6 w-6 text-muted-foreground" />
          </div>
          <h1 className="mt-4 text-xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{body}</p>
        </div>
      </div>
    </div>
  );
}
