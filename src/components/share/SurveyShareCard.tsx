import { useRef, useState } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Check, Copy, Download, ExternalLink, Mail, MessageCircle, Printer, Share2, Smartphone, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrintSheet } from "@/components/share/PrintSheet";
import { renderBilingual, useT, type LangMode } from "@/lib/i18n";
import {
  canNativeShare,
  downloadQrPng,
  mailtoHref,
  nativeShare,
  printSheetOnly,
  qrFileName,
  shareText,
  smsHref,
  surveyUrl,
  whatsappHref,
} from "@/lib/share";
import type { Survey } from "@/lib/surveys";
import { toast } from "sonner";

/** Ink-on-paper QR needs the dark module colour to be near-black, not brand indigo. */
const QR_PRINT_FG = "#111111";
const QR_SCREEN_FG = "hsl(226, 64%, 24%)";

/**
 * Everything needed to put a survey in a parent's hands: the QR, the link, and
 * the channels the link travels on.
 *
 * A parent never authenticates — the slug in the URL is the credential — so
 * this card is the entire distribution story for the public side.
 */
export function SurveyShareCard({ survey, mode }: { survey: Survey; mode: LangMode }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
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

  return (
    <>
      <div className="rounded-surface border border-border/70 bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-6 sm:flex-row">
          <div className="shrink-0">
            <div className="grid place-items-center rounded-surface border border-border/70 bg-white p-3">
              <QRCodeSVG value={url} size={148} level="M" bgColor="transparent" fgColor={QR_SCREEN_FG} />
            </div>
            {/* Rendered off-screen at print resolution purely as the source for
                the PNG download — the 148px display copy would pixelate on a
                poster. */}
            <div ref={qrRef} className="sr-only" aria-hidden>
              <QRCodeCanvas value={url} size={1024} level="M" marginSize={2} bgColor="#FFFFFF" fgColor={QR_PRINT_FG} />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="eyebrow">{t("surveyLink")}</div>
            <div className="mt-1.5 break-all rounded-field border border-border/60 bg-muted/60 px-3 py-2.5 font-mono text-xs sm:text-sm">
              {url}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={copy}>
                {copied ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}
                {copied ? t("copied") : t("copyLink")}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink strokeWidth={1.8} />
                  {t("open")}
                </a>
              </Button>
            </div>

            <div className="mt-5 eyebrow">{t("shareVia")}</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" asChild>
                <a href={whatsappHref(message)} target="_blank" rel="noreferrer">
                  <MessageCircle strokeWidth={1.8} />
                  {t("shareWhatsApp")}
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={smsHref(message)}>
                  <Smartphone strokeWidth={1.8} />
                  {t("shareSms")}
                </a>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <a href={mailtoHref(title, message)}>
                  <Mail strokeWidth={1.8} />
                  {t("shareEmail")}
                </a>
              </Button>
              {canNativeShare() && (
                <Button size="sm" variant="outline" onClick={() => void nativeShare(title, t("shareMessage"), url)}>
                  <Share2 strokeWidth={1.8} />
                  {t("shareSurvey")}
                </Button>
              )}
            </div>

            <div className="mt-5 eyebrow">QR</div>
            <div className="mt-1.5 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (!downloadQrPng(qrRef.current, qrFileName(survey.title_en, survey.slug!))) {
                    toast.error(t("somethingWrongTitle"));
                  }
                }}
              >
                <Download strokeWidth={1.8} />
                {t("downloadQr")}
              </Button>
              <Button size="sm" variant="outline" onClick={printSheetOnly}>
                <Printer strokeWidth={1.8} />
                {t("printQr")}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* The poster. Sized and worded to be taped to a wall and scanned by
          someone standing in front of it. */}
      <PrintSheet>
        <div className="flex min-h-screen flex-col items-center px-16 py-16 text-center">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-neutral-900">
              <Shield className="h-7 w-7 text-white" strokeWidth={1.6} />
            </div>
            <div className="text-left">
              <div className="text-base font-semibold">{t("appName")}</div>
              <div className="text-xs text-neutral-600">{t("govOf")}</div>
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
