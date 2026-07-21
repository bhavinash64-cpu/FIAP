import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy, Download, ExternalLink, Loader2, Mail, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PrintSheet } from "@/components/share/PrintSheet";
import { Logo } from "@/components/Logo";
import { renderBilingual, useT, type LangMode } from "@/lib/i18n";
import { downloadQrPng, mailtoHref, printSheetOnly, qrFileName, shareText, surveyUrl } from "@/lib/share";
import { regenerateSurveyLink, type Survey } from "@/lib/surveys";
import { toast } from "sonner";

/** Ink-on-paper QR needs the dark module colour to be near-black, not brand indigo. */
const QR_PRINT_FG = "#111111";
const QR_SCREEN_FG = "hsl(226, 64%, 24%)";

/**
 * Everything needed to put a survey in a family's hands: the QR, the link, and
 * the six things you can do with them.
 *
 * A respondent never authenticates — the slug in the URL is the credential — so
 * this card is the entire distribution story for the public side.
 *
 * The actions are ONE uniform grid rather than three labelled clusters of two.
 * Clusters looked organised in a mockup and read as clutter in use: three
 * eyebrows, three grids, and a conditional seventh button that orphaned itself
 * on any device with a native share sheet. Six equal cells, one rhythm, no
 * orphan row at any breakpoint.
 */
export function SurveyShareCard({ survey, mode }: { survey: Survey; mode: LangMode }) {
  const t = useT();
  const qc = useQueryClient();
  const reduce = useReducedMotion();
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  if (!survey.slug) return null;

  const url = surveyUrl(survey.slug);
  const title = renderBilingual(mode, survey.title_en, survey.title_te).primary;
  const message = shareText(`${title}\n\n${t("shareMessage")}`, url);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t("somethingWrongTitle"));
    }
  }

  async function regenerate() {
    setRegenerating(true);
    try {
      await regenerateSurveyLink(survey.id, survey.slug);
      await qc.invalidateQueries({ queryKey: ["surveys"] });
      toast.success(t("regenerateQrDone"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("somethingWrongTitle"));
    } finally {
      setRegenerating(false);
      setConfirmOpen(false);
    }
  }

  return (
    <>
      <div className="rounded-surface border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-stretch sm:gap-8">
          {/* QR is the hero — large, framed, with a scan caption. */}
          <div className="flex shrink-0 flex-col items-center text-center">
            <motion.div
              key={survey.slug}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 24 }}
              className="grid place-items-center rounded-surface border border-border/70 bg-white p-4 shadow-sm"
            >
              <QRCodeSVG value={url} size={196} level="M" bgColor="transparent" fgColor={QR_SCREEN_FG} />
            </motion.div>
            <p className="mt-2.5 t-caption font-medium text-muted-foreground">{t("scanToOpen")}</p>
            {/* Rendered off-screen at print resolution purely as the source for
                the PNG download — the display copy would pixelate on a poster. */}
            <div ref={qrRef} className="sr-only" aria-hidden>
              <QRCodeCanvas value={url} size={1024} level="M" marginSize={2} bgColor="#FFFFFF" fgColor={QR_PRINT_FG} />
            </div>
          </div>

          <div className="flex min-w-0 flex-1 flex-col">
            <div className="eyebrow">{t("surveyLink")}</div>
            <div className="mt-1.5 break-all rounded-field border border-border/60 bg-muted/60 px-3 py-2.5 font-mono text-xs sm:text-sm">
              {url}
            </div>

            {/* Six actions, one grid, every cell the same width and height. */}
            <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-3">
              <Button onClick={copy} className="w-full">
                {copied ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}
                {copied ? t("copied") : t("copyLink")}
              </Button>

              <Button variant="outline" asChild className="w-full">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink strokeWidth={1.8} />
                  {t("open")}
                </a>
              </Button>

              <Button variant="outline" asChild className="w-full">
                <a href={mailtoHref(title, message)}>
                  <Mail strokeWidth={1.8} />
                  {t("shareEmail")}
                </a>
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  if (!downloadQrPng(qrRef.current, qrFileName(survey.title_en, survey.slug!))) {
                    toast.error(t("somethingWrongTitle"));
                  }
                }}
              >
                <Download strokeWidth={1.8} />
                {t("downloadQr")}
              </Button>

              <Button variant="outline" onClick={printSheetOnly} className="w-full">
                <Printer strokeWidth={1.8} />
                {t("printQr")}
              </Button>

              <Button variant="outline" onClick={() => setConfirmOpen(true)} className="w-full">
                <RefreshCw strokeWidth={1.8} />
                {t("regenerateQr")}
              </Button>
            </div>

            <p className="mt-3 t-caption text-muted-foreground">{t("noLoginNeeded")}</p>
          </div>
        </div>
      </div>

      {/* Rotating the slug retires every poster already in the field, so it
          asks first and names that consequence rather than implying it. */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("regenerateQr")}</AlertDialogTitle>
            <AlertDialogDescription>{t("regenerateQrConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={regenerating}>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void regenerate();
              }}
              disabled={regenerating}
              className="gap-2"
            >
              {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.8} />}
              {t("regenerateQr")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* The poster. Sized and worded to be taped to a wall and scanned by
          someone standing in front of it. */}
      <PrintSheet>
        <div className="flex min-h-screen flex-col items-center px-16 py-16 text-center">
          <div className="flex items-center gap-3">
            <Logo size={48} />
            <div className="text-left">
              <div className="text-base font-semibold">{t("appName")}</div>
              <div className="text-xs text-neutral-600">{t("orgLine")}</div>
            </div>
          </div>

          <h1 className="mt-12 max-w-2xl text-4xl font-semibold leading-tight">{title}</h1>
          <p className="mt-5 max-w-xl text-lg text-neutral-700">{t("scanToBegin")}</p>

          <div className="mt-10 border-4 border-neutral-900 p-5">
            <QRCodeSVG value={url} size={288} level="M" bgColor="#FFFFFF" fgColor={QR_PRINT_FG} />
          </div>

          <p className="mt-10 text-sm text-neutral-600">{t("orOpenLink")}</p>
          <p className="mt-1.5 font-mono text-lg font-semibold">{url}</p>

          <p className="mt-auto pt-12 text-sm text-neutral-600">{t("noLoginNeeded")}</p>
        </div>
      </PrintSheet>
    </>
  );
}
