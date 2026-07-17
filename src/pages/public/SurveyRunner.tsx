import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Shield, CheckCircle2, Lock, SearchX, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SurveyForm } from "@/components/survey/SurveyForm";
import { getPublicSurvey, submitSurveyResponse, trackSurveyView, type AnswerValue, type PublicSurveyState } from "@/lib/surveys";
import { useLangMode, chromeLang, renderBilingual } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";

const EASE = [0.33, 1, 0.68, 1] as const; // --ease-out

export default function SurveyRunner() {
  const { slug } = useParams();
  const mode = useLangMode();
  const lang = chromeLang(mode);
  const [state, setState] = useState<PublicSurveyState | "loading" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const submitLock = useRef(false);
  const viewTracked = useRef(false);
  const startedAt = useRef<Date | null>(null);
  const reduce = useReducedMotion();

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
      await submitSurveyResponse(state.survey.id, mode, answers, startedAt.current ?? undefined);
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
      <div className="min-h-dvh grid place-items-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
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
    const title = renderBilingual(mode, state.survey.title_en, state.survey.title_te).primary;
    return (
      <StatusScreen icon={Lock} title="This survey is closed" body={`"${title}" is no longer accepting responses. Thank you for your interest.`} />
    );
  }

  if (submitted) {
    return (
      <div className="min-h-dvh grid place-items-center bg-canvas px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-center max-w-sm"
        >
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={reduce ? { duration: 0.38, ease: EASE } : { type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
            className="mx-auto h-16 w-16 rounded-pill bg-success/15 grid place-items-center"
          >
            <CheckCircle2 className="h-7 w-7 text-success" strokeWidth={1.5} />
          </motion.div>
          <h1 className="mt-6 t-section">{lang === "te" ? "ధన్యవాదాలు!" : "Thank you!"}</h1>
          <p className="mt-2 t-body text-muted-foreground">
            {lang === "te" ? "మీ సమాధానం విజయవంతంగా సమర్పించబడింది." : "Your response has been submitted successfully."}
          </p>
        </motion.div>
      </div>
    );
  }

  return <SurveyForm survey={state.survey} questions={state.questions} onSubmit={handleSubmit} submitting={submitting} />;
}

function StatusScreen({ icon: Icon, title, body }: { icon: typeof SearchX; title: string; body: string }) {
  const reduce = useReducedMotion();
  return (
    <div className="min-h-dvh flex flex-col bg-canvas">
      <header className="border-b border-border bg-card/90">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="h-7 w-7 rounded-control brand-gradient grid place-items-center shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" strokeWidth={1.5} />
          </div>
          <div className="t-caption font-semibold text-muted-foreground">AP Police Family Assessment Platform</div>
          <div className="ml-auto"><LangToggle size="sm" /></div>
        </div>
      </header>

      {/* Empty-state pattern: 64px accent-tint circle, monochrome icon, t-section + t-body */}
      <div className="flex-1 grid place-items-center px-6">
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: EASE }}
          className="text-center max-w-sm"
        >
          <div className="mx-auto h-16 w-16 rounded-pill bg-accent-tint grid place-items-center">
            <Icon className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h1 className="mt-6 t-section">{title}</h1>
          <p className="mt-2 t-body text-muted-foreground">{body}</p>
        </motion.div>
      </div>
    </div>
  );
}
