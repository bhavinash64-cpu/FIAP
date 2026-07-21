import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Download, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AssessmentShell } from "@/components/assessment/AssessmentShell";
import { chromeLang, renderBilingual, useLangMode, useT, type LangMode } from "@/lib/i18n";
import type { SubmissionReceipt } from "@/lib/familyAccess";
import type { Survey } from "@/lib/surveys";

/**
 * The last screen a family will ever see in this product.
 *
 * The rule: this is terminal. There is no link, button or affordance here that
 * leads to a dashboard, a survey list, a home page or another assessment —
 * because for a respondent none of those exist. The only actions are printing
 * the acknowledgement and closing the tab. Anything added to this file that
 * navigates somewhere is a bug.
 */

const EASE = [0.33, 1, 0.68, 1] as const;

function formatDate(iso: string, mode: LangMode): string {
  const locale = chromeLang(mode) === "te" ? "te-IN" : "en-IN";
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export function FamilyThankYouStage({
  survey,
  mode,
  receipt,
}: {
  /* Both of these are conveniences for the printed sheet, never preconditions.
     The receipt is the record; an instrument that was withdrawn between the
     submit call and this render must not stop a family being told their
     answers arrived, so the survey is allowed to be absent. */
  survey?: Survey | null;
  mode?: LangMode;
  receipt: SubmissionReceipt;
}) {
  const t = useT();
  const reduce = useReducedMotion();
  const activeMode = useLangMode();
  const lang = mode ?? activeMode;
  const title = survey ? renderBilingual(lang, survey.title_en, survey.title_te).primary : "";
  const when = formatDate(receipt.submittedAt, lang);
  const completion = `${Math.round(receipt.completionPct)}%`;

  return (
    <>
      {/* Screen. Hidden when printing so the acknowledgement sheet below is the
          only thing on the page — no nav chrome, no buttons. */}
      <div className="print:hidden">
        <AssessmentShell>
          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.42, ease: EASE }}
            className="text-center"
          >
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={
                reduce
                  ? { duration: 0.42, ease: EASE }
                  : { type: "spring", stiffness: 240, damping: 17, delay: 0.12 }
              }
              className="mx-auto grid h-20 w-20 place-items-center rounded-pill bg-success/15"
            >
              <CheckCircle2 className="h-9 w-9 text-success" strokeWidth={1.6} />
            </motion.div>

            <h1 className="mt-7 t-hero">{t("thankYou")}</h1>
            <p className="mx-auto mt-3 max-w-md t-body text-balance leading-relaxed text-muted-foreground">
              {t("thankYouBody")}
            </p>
          </motion.div>

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, ease: EASE, delay: 0.18 }}
            className="mt-8"
          >
            <dl className="divide-y divide-border rounded-surface border border-border/70 bg-card px-4">
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="t-caption text-muted-foreground">{t("referenceId")}</dt>
                <dd className="t-body font-semibold tabular-nums tracking-wide">{receipt.referenceId}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="t-caption text-muted-foreground">{t("assessmentIdLabel")}</dt>
                <dd className="t-body font-medium tabular-nums tracking-wide">{receipt.assessmentId}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-3.5">
                <dt className="t-caption text-muted-foreground">{t("submittedOn")}</dt>
                <dd className="t-body font-medium">{when}</dd>
              </div>
            </dl>

            {/* Completion is stated once, quietly. A family that skipped items has
                not failed at anything, so it never gets a bar or a colour. */}
            <p className="mt-3 text-center t-caption text-muted-foreground">
              {completion} {t("completionLabel")}
            </p>

            <Button
              onClick={() => window.print()}
              variant="outline"
              size="xl"
              shape="pill"
              className="mt-4 w-full gap-2"
            >
              <Download className="h-[18px] w-[18px]" strokeWidth={1.8} />
              {t("downloadAcknowledgement")}
            </Button>

            <p className="mt-6 text-center t-caption text-muted-foreground">{t("closingNote")}</p>
          </motion.div>
        </AssessmentShell>
      </div>

      {/* Print sheet. `window.print()` lets the family save it as a PDF or send it
          to paper without the app needing a PDF library on the respondent route. */}
      <div className="hidden bg-white p-10 text-black print:block">
        <div className="flex items-center gap-3 border-b border-neutral-300 pb-5">
          <div className="grid h-11 w-11 place-items-center rounded-control bg-neutral-900">
            <Shield className="h-6 w-6 text-white" strokeWidth={1.6} />
          </div>
          <div>
            <div className="text-sm font-semibold">{t("appName")}</div>
            <div className="text-xs text-neutral-600">{t("orgLine")}</div>
          </div>
        </div>

        <h1 className="mt-8 text-2xl font-semibold">{t("thankYou")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-700">{t("thankYouBody")}</p>

        <table className="mt-8 w-full max-w-xl border-collapse text-sm">
          <tbody>
            {title ? (
              <tr className="border-t border-neutral-300">
                <th scope="row" className="py-3 pr-6 text-left font-medium text-neutral-600">
                  {t("surveys")}
                </th>
                <td className="py-3">{title}</td>
              </tr>
            ) : null}
            <tr className="border-t border-neutral-300">
              <th scope="row" className="py-3 pr-6 text-left font-medium text-neutral-600">
                {t("referenceId")}
              </th>
              <td className="py-3 font-semibold tracking-wide">{receipt.referenceId}</td>
            </tr>
            <tr className="border-t border-neutral-300">
              <th scope="row" className="py-3 pr-6 text-left font-medium text-neutral-600">
                {t("assessmentIdLabel")}
              </th>
              <td className="py-3 tracking-wide">{receipt.assessmentId}</td>
            </tr>
            <tr className="border-t border-neutral-300">
              <th scope="row" className="py-3 pr-6 text-left font-medium text-neutral-600">
                {t("submittedOn")}
              </th>
              <td className="py-3">{when}</td>
            </tr>
            <tr className="border-y border-neutral-300">
              <th scope="row" className="py-3 pr-6 text-left font-medium text-neutral-600">
                {t("completionLabel")}
              </th>
              <td className="py-3">{completion}</td>
            </tr>
          </tbody>
        </table>

        <p className="mt-8 max-w-xl text-xs leading-relaxed text-neutral-600">{t("privacyBody")}</p>
      </div>
    </>
  );
}
