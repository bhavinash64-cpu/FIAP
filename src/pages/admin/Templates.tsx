import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Loader2, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { listBank, importInstrumentsToSurvey, type BankInstrument } from "@/lib/questionBank";
import { createSurvey } from "@/lib/surveys";
import { useLangMode, useT, renderBilingual } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Research Templates — the validated instruments as ready-to-launch surveys.
 *
 * "Use template" creates the survey and copies the whole instrument in, so an
 * administrator goes from here to a complete, publishable questionnaire in one
 * action. Questions are copied (see importInstrumentsToSurvey), so a later edit
 * to the library never rewrites a survey that is already collecting responses.
 */
export default function Templates() {
  const t = useT();
  const mode = useLangMode();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: instruments, isLoading } = useQuery({ queryKey: ["question-bank"], queryFn: listBank });

  async function createFromTemplate(inst: BankInstrument) {
    if (busyId) return;
    if (!inst.items.length) {
      toast.error("This template has no questions yet.");
      return;
    }
    setBusyId(inst.id);
    try {
      const surveyId = await createSurvey({
        title_en: inst.name_en,
        title_te: inst.name_te ?? undefined,
        description_en: inst.blurb_en ?? undefined,
        description_te: inst.blurb_te ?? undefined,
      });
      await importInstrumentsToSurvey(surveyId, [inst.id]);
      qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(`Created “${inst.name_en}” with ${inst.items.length} questions`);
      nav(`/app/surveys/${surveyId}/edit`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the survey from this template.");
      setBusyId(null);
    }
  }

  return (
    <PageContainer>
      <PageHeader
        eyebrow={t("navGroupSurveys")}
        title={t("navTemplates")}
        subtitle="Start a new survey from a validated research instrument. Every question, scale and translation is copied in, ready to publish or adapt."
      />

      {isLoading ? (
        <div className="mt-16 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : !instruments?.length ? (
        <div className="mt-8 rounded-surface border border-dashed border-border p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <LayoutTemplate className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">No templates available</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">
            The Question Library is empty. Add an instrument there and it becomes available as a template.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {instruments.map((inst) => {
            const name = renderBilingual(mode, inst.name_en, inst.name_te).primary;
            const blurb = renderBilingual(mode, inst.blurb_en ?? "", inst.blurb_te).primary;
            const busy = busyId === inst.id;
            return (
              // h-full + flex-col makes every card in a row the same height; the
              // meta+button sit in an mt-auto footer so buttons align across the
              // whole grid regardless of blurb length.
              <div
                key={inst.id}
                className="flex h-full flex-col rounded-surface border border-border/70 bg-card p-5 transition-shadow duration-base hover:shadow-md"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-accent-tint">
                    <LayoutTemplate className="h-5 w-5 text-primary" strokeWidth={1.6} />
                  </span>
                  {inst.is_builtin ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="h-3 w-3" strokeWidth={2} />
                      Validated
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1">
                      <Sparkles className="h-3 w-3" strokeWidth={2} />
                      Custom
                    </Badge>
                  )}
                </div>

                <h2 className="mt-4 t-card leading-snug">{name}</h2>
                {blurb && <p className="mt-1.5 line-clamp-3 t-caption leading-relaxed text-muted-foreground">{blurb}</p>}

                <div className="mt-auto pt-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 t-caption text-muted-foreground">
                    <span className="font-semibold text-foreground">{t("nQuestions", { n: inst.items.length })}</span>
                    {inst.source && <span className="truncate">· {inst.source}</span>}
                  </div>
                  <Button
                    onClick={() => createFromTemplate(inst)}
                    disabled={busy || !inst.items.length}
                    className={cn("mt-4 w-full gap-2", busy && "opacity-90")}
                  >
                    {busy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating…
                      </>
                    ) : (
                      <>
                        Use this template
                        <ArrowRight strokeWidth={1.8} />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
}
