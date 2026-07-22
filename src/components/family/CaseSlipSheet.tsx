import { QRCodeCanvas } from "qrcode.react";
import { PrintSheet } from "@/components/share/PrintSheet";
import { Logo } from "@/components/Logo";
import { translate, useT, type LangMode } from "@/lib/i18n";
import { familyLinkUrl, formatPhone, type FamilyCaseRow } from "@/lib/familyCases";

/*
   The physical artefact an officer leaves behind on the kitchen table.

   The rule that governs it: everything on this page has to survive the visit.
   Nobody will be standing there to explain it, the family may open it weeks
   later, and the person who eventually types the PIN is often not the person
   who was handed the slip. So the credentials are set large enough to read
   aloud across a room, the link is printed as text because people do retype
   these, and nothing on the sheet depends on the app being open.
*/

/** Ink-on-paper QR needs a near-black module colour, not brand indigo. */
const QR_PRINT_FG = "#111111";

/**
 * Scan-then-sign-in, in both languages, always.
 *
 * The slip outlives the session it was printed in: an officer working in
 * English prints it, and a Telugu-reading relative is the one who picks it up
 * three weeks later. So this line ignores the current language mode entirely
 * and prints both — it is the only sentence on the sheet that has to be
 * *understood* rather than merely copied.
 */
function instructionLine(lang: LangMode): string {
  return `${translate(lang, "scanToOpen")} · ${translate(lang, "familySignInIntro")}`;
}

function formatValidUntil(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

export function CaseSlipSheet({ caseRow }: { caseRow: FamilyCaseRow }) {
  const t = useT();
  const url = familyLinkUrl(caseRow.access_token);

  return (
    <PrintSheet>
      <div className="mx-auto w-full max-w-[148mm] px-10 py-10 font-sans text-black">
        <header className="flex items-center gap-3 border-b-2 border-neutral-900 pb-4">
          <Logo size={40} />
          <div className="min-w-0">
            <div className="text-base font-semibold leading-tight">{t("appName")}</div>
            <div className="text-[11px] leading-tight text-neutral-600">{t("orgLine")}</div>
          </div>
          <div className="ml-auto text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-700">
            {t("familySignInTitle")}
          </div>
        </header>

        <dl className="mt-5 space-y-1.5 text-[12px]">
          <SlipFact label={t("referenceId")} value={caseRow.reference_id} mono />
          <SlipFact label={t("caseFamilyHead")} value={caseRow.family_head_name} />
          <SlipFact label={t("caseSurvey")} value={caseRow.survey_title_en} />
          {/* Both authored titles when they differ — same reason as the
              instruction line: the reader may not be the recipient. */}
          {caseRow.survey_title_te && caseRow.survey_title_te.trim() !== caseRow.survey_title_en && (
            <SlipFact label="" value={caseRow.survey_title_te} />
          )}
        </dl>

        <div className="mt-6 flex flex-col items-center">
          <div className="border-2 border-neutral-900 p-3">
            {/* marginSize on top of the white padding: a printed QR taped to a
                dark surface loses its quiet zone otherwise, and phone cameras
                give up on it. */}
            <QRCodeCanvas value={url} size={180} level="M" marginSize={2} bgColor="#FFFFFF" fgColor={QR_PRINT_FG} />
          </div>
          <p className="mt-2.5 max-w-full break-all text-center font-mono text-[11px] leading-snug text-neutral-800">
            {url}
          </p>
        </div>

        {/* One credential now, not two. The PIN is retired — the QR/link is the
            secret, and this is the number the family types to confirm it is
            theirs. Letter-spaced and grouped so a caller reading it down a phone
            line can keep their place mid-digit. */}
        <div className="mt-6">
          <Credential
            label={`${translate("en", "casePhone")} · ${translate("te", "casePhone")}`}
            value={formatPhone(caseRow.phone)}
          />
        </div>

        <p className="mt-4 text-center text-[12px] font-semibold">
          Valid until {formatValidUntil(caseRow.expires_at)}
        </p>

        <div className="mt-5 border-t border-neutral-300 pt-3 text-[11px] leading-relaxed text-neutral-800">
          <p>{instructionLine("en")}</p>
          <p className="mt-1">{instructionLine("te")}</p>
        </div>

        <p className="mt-4 text-[10px] leading-relaxed text-neutral-500">{t("familyNeedHelp")}</p>
      </div>
    </PrintSheet>
  );
}

function SlipFact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-[34%] shrink-0 text-neutral-600">{label}</dt>
      <dd className={mono ? "font-mono font-semibold tracking-wide" : "font-medium"}>{value}</dd>
    </div>
  );
}

function Credential({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-neutral-900 px-3 py-2.5 text-center">
      <div className="text-[9px] font-semibold uppercase leading-tight tracking-[0.1em] text-neutral-600">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold tracking-[0.18em] tabular-nums">{value}</div>
    </div>
  );
}
