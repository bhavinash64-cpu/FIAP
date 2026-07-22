import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Eye,
  FilePlus2,
  Link2,
  Loader2,
  Lock,
  LogIn,
  Mail,
  MousePointerClick,
  Pencil,
  PlayCircle,
  Printer,
  RefreshCw,
  RotateCcw,
  TimerOff,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Inspector, InspectorSection } from "@/components/admin/Inspector";
import { MeterRow } from "@/components/admin/SectionPanel";
import { CaseStatusBadge } from "@/components/family/CaseStatusBadge";
import { CaseSlipSheet } from "@/components/family/CaseSlipSheet";
import { FollowUpPanel } from "@/components/family/FollowUpPanel";
import {
  caseQrFileName,
  daysUntil,
  deleteFamilyCase,
  extendFamilyCase,
  familyLinkUrl,
  formatPhone,
  getFamilyCaseEvents,
  regenerateLink,
  reopenFamilyCase,
  type FamilyCaseRow,
} from "@/lib/familyCases";
import { downloadQrPng, mailtoHref, printSheetOnly } from "@/lib/share";
import { renderBilingual, useLangMode, useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/*
   Everything an officer needs to do with one enrolled family, without leaving
   the case list.

   The rule that governs this panel: the credentials are the product here. A
   family's link, QR and PIN are the only way into their assessment, so they get
   the top of the panel, the largest type, and one-tap copies — and every act of
   revealing or rotating them leaves a record. Case facts and history sit below
   because they answer questions; the credentials answer the phone call.
*/

/** Ink-on-paper QR needs a near-black module colour, not brand indigo. */
const QR_PRINT_FG = "#111111";
const QR_SCREEN_FG = "hsl(226, 64%, 24%)";

const EVENT_META: Record<string, { label: string; icon: LucideIcon }> = {
  created: { label: "Case created", icon: FilePlus2 },
  updated: { label: "Case details edited", icon: Pencil },
  link_opened: { label: "Secure link opened", icon: MousePointerClick },
  login: { label: "Family signed in", icon: LogIn },
  started: { label: "Assessment started", icon: PlayCircle },
  submitted: { label: "Assessment submitted", icon: CheckCircle2 },
  pin_viewed: { label: "PIN revealed by staff", icon: Eye },
  pin_regenerated: { label: "PIN regenerated", icon: RefreshCw },
  link_regenerated: { label: "Secure link regenerated", icon: Link2 },
  extended: { label: "Access extended", icon: CalendarPlus },
  reopened: { label: "Case reopened", icon: RotateCcw },
  locked_out: { label: "Locked after failed attempts", icon: Lock },
  expired: { label: "Access expired", icon: TimerOff },
};

/** Unknown slugs still have to read as English, not as a database column. */
function humanise(slug: string): string {
  const words = slug.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatStamp(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleString();
  }
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  try {
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
    for (const [unit, ms] of RELATIVE_UNITS) {
      if (Math.abs(diff) >= ms) return rtf.format(Math.round(diff / ms), unit);
    }
    return rtf.format(Math.round(diff / 1000), "second");
  } catch {
    return formatStamp(iso);
  }
}

export function FamilyCaseInspector(props: {
  caseRow: FamilyCaseRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Refetch the list — every mutation below changes a column in it. */
  onChanged: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  positionLabel?: string;
}) {
  const { caseRow, open, onOpenChange, onChanged, onPrev, onNext, positionLabel } = props;
  const t = useT();
  const mode = useLangMode();
  const qc = useQueryClient();
  const qrRef = useRef<HTMLDivElement>(null);

  const caseId = caseRow?.id ?? null;

  // A regenerated credential has to be on screen the instant the mutation
  // returns — the officer is usually reading it out while the request is still
  // settling — but it is stamped with the case it belongs to and read *through*
  // the row rather than mirrored into state. Stepping to the next family with
  // j/k reuses this component, and a mirrored copy would paint one family's PIN
  // and QR under another family's name until an effect caught up a frame later.
  const [minted, setMinted] = useState<{ caseId: string; token?: string } | null>(null);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "phone" | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"link" | "reopen" | "delete" | null>(null);

  useEffect(() => setCopied(null), [caseId]);

  const { data: events, isPending: eventsPending } = useQuery({
    queryKey: ["family-case-events", caseId],
    queryFn: () => getFamilyCaseEvents(caseId as string),
    enabled: open && !!caseId,
  });

  const refreshTimeline = useCallback(() => {
    if (caseId) void qc.invalidateQueries({ queryKey: ["family-case-events", caseId] });
  }, [qc, caseId]);

  const copy = useCallback(
    async (text: string, which: "link" | "phone", message: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(which);
        window.setTimeout(() => setCopied(null), 1600);
        toast.success(message);
      } catch {
        toast.error(t("somethingWrongTitle"));
      }
    },
    [t],
  );

  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
      toast.success(success);
      onChanged();
      refreshTimeline();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("somethingWrongTitle"));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (!caseRow) return null;

  const fresh = minted?.caseId === caseRow.id ? minted : null;
  const token = fresh?.token ?? caseRow.access_token;

  const url = familyLinkUrl(token);
  const surveyTitle = renderBilingual(mode, caseRow.survey_title_en, caseRow.survey_title_te).primary;
  const remaining = daysUntil(caseRow.expires_at);
  const expiryLabel = remaining > 0 ? t("caseExpiresIn", { n: remaining }) : t("caseExpiredOn");
  const place = [caseRow.village, caseRow.district].filter(Boolean).join(", ");

  // The PIN never travels with the link. A single message containing both is a
  // complete set of credentials sitting in a mailbox, so the email carries the
  // address and points at the printed slip for the rest. WhatsApp and SMS are
  // absent for the same reason, one step further: a confidential bereavement
  // link has no business in a consumer messaging app's backup.
  const emailSubject = `${t("familySignInTitle")} · ${caseRow.reference_id}`;
  const emailBody = [
    `${caseRow.family_head_name},`,
    "",
    surveyTitle,
    "",
    url,
    "",
    t("familyPinHelp"),
  ].join("\n");

  return (
    <>
      <Inspector
        open={open}
        onOpenChange={onOpenChange}
        eyebrow={<span className="font-mono tracking-wide">{caseRow.reference_id}</span>}
        title={caseRow.family_head_name}
        subtitle={caseRow.deceased_name}
        onPrev={onPrev}
        onNext={onNext}
        positionLabel={positionLabel}
        headerMeta={
          <>
            <CaseStatusBadge status={caseRow.status} />
            {place && <span className="t-caption text-muted-foreground">{place}</span>}
            <span className="min-w-0 truncate t-caption text-muted-foreground">{surveyTitle}</span>
          </>
        }
        footer={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await extendFamilyCase(caseRow.id, 30);
                }, "Access extended by 30 days")
              }
            >
              <CalendarPlus className="h-3.5 w-3.5" strokeWidth={1.7} /> {t("caseExtend")}
            </Button>

            {caseRow.status === "completed" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm("reopen")}>
                <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.7} /> {t("caseReopen")}
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => setConfirm("delete")}
              className="ml-auto text-danger hover:bg-[hsl(var(--danger)/0.08)] hover:text-danger"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.7} /> Delete
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          {/* ── Credentials ─────────────────────────────────────────────── */}
          <InspectorSection title={t("caseCredentials")}>
            <div className="rounded-surface border border-border/70 bg-sunken/50 p-4">
              {/* Not a <label>: the copy button sits in the same row, and a
                  label would redirect its click to the input. */}
              <div>
                <div className="eyebrow">{t("caseSecureLink")}</div>
                <div className="mt-1.5 flex items-stretch gap-2">
                  <input
                    readOnly
                    value={url}
                    onFocus={(e) => e.currentTarget.select()}
                    aria-label={t("caseSecureLink")}
                    className="min-w-0 flex-1 rounded-field border border-border/60 bg-card px-3 py-2 font-mono text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    onClick={() => void copy(url, "link", t("copied"))}
                  >
                    {copied === "link" ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}
                    <span className="sr-only sm:not-sr-only">{t("copyLink")}</span>
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-4">
                <div>
                  <div className="eyebrow">{t("casePhone")}</div>
                  {/* The number the family types after opening their link. Not a
                      secret — it is on the case file — so there is nothing to
                      reveal and nothing to audit. The link is the credential. */}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="t-title font-mono tabular-nums tracking-[0.14em]">{formatPhone(caseRow.phone)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label="Copy phone number"
                      onClick={() => void copy(caseRow.phone, "phone", t("copied"))}
                    >
                      {copied === "phone" ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}
                    </Button>
                  </div>
                </div>

                <div>
                  <div className="eyebrow">{t("casePhone")}</div>
                  <div className="mt-1 t-title font-mono tabular-nums tracking-[0.06em]">
                    {formatPhone(caseRow.phone)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="shrink-0">
                  <div className="grid w-fit place-items-center rounded-field border border-border/70 bg-white p-2.5">
                    <QRCodeCanvas value={url} size={132} level="M" marginSize={1} bgColor="#FFFFFF" fgColor={QR_SCREEN_FG} />
                  </div>
                  <p className="mt-1.5 t-caption text-tertiary">{t("caseQrCode")}</p>
                  {/* Off-screen at print resolution — the on-screen copy would
                      pixelate the moment anyone enlarged the download. */}
                  <div ref={qrRef} className="sr-only" aria-hidden>
                    <QRCodeCanvas value={url} size={1024} level="M" marginSize={2} bgColor="#FFFFFF" fgColor={QR_PRINT_FG} />
                  </div>
                </div>

                <div className="grid flex-1 grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (!downloadQrPng(qrRef.current, caseQrFileName(caseRow.reference_id, caseRow.family_head_name))) {
                        toast.error(t("somethingWrongTitle"));
                      }
                    }}
                  >
                    <Download strokeWidth={1.7} /> {t("caseDownloadQr")}
                  </Button>

                  <Button size="sm" variant="outline" onClick={printSheetOnly}>
                    <Printer strokeWidth={1.7} /> {t("casePrintSlip")}
                  </Button>

                  <Button size="sm" variant="outline" asChild>
                    <a href={mailtoHref(emailSubject, emailBody)}>
                      <Mail strokeWidth={1.7} /> {t("caseEmailLink")}
                    </a>
                  </Button>


                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => setConfirm("link")}
                    className="col-span-2"
                  >
                    <Link2 strokeWidth={1.7} /> {t("caseRegenerateLink")}
                  </Button>
                </div>
              </div>
            </div>
          </InspectorSection>

          {/* ── Case details ────────────────────────────────────────────── */}
          <InspectorSection title="Case details">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <Fact label={t("caseDeceased")} value={caseRow.deceased_name} />
              <Fact label={t("caseFamilyHead")} value={caseRow.family_head_name} />
              <Fact label={t("caseRelationship")} value={caseRow.relationship} />
              <Fact label={t("casePhone")} value={formatPhone(caseRow.phone)} mono />
              <Fact label={t("caseDistrict")} value={caseRow.district} />
              <Fact label={t("caseVillage")} value={caseRow.village ?? "—"} />
              <Fact
                label={t("caseLanguage")}
                value={caseRow.preferred_language === "te" ? t("telugu") : t("english")}
              />
              <Fact label={t("caseSurvey")} value={surveyTitle} />
              <Fact label={t("caseOfficer")} value={caseRow.officer_name ?? "—"} />
              <Fact label="Created" value={formatStamp(caseRow.created_at)} />
              {caseRow.notes && <Fact label={t("caseNotes")} value={caseRow.notes} className="sm:col-span-2" />}
            </dl>
          </InspectorSection>

          {/* ── Progress ────────────────────────────────────────────────── */}
          <InspectorSection title="Progress">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <CaseStatusBadge status={caseRow.status} />
                <span className={cn("t-caption font-medium", remaining > 0 ? "text-muted-foreground" : "text-danger")}>
                  {expiryLabel}
                </span>
                <span className="t-caption text-tertiary">{formatStamp(caseRow.expires_at)}</span>
              </div>

              {caseRow.completion_pct != null && (
                <MeterRow
                  label={t("completionLabel")}
                  value={caseRow.completion_pct}
                  max={100}
                  caption={`${Math.round(caseRow.completion_pct)}%`}
                />
              )}

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                <Fact label="Link opened" value={formatStamp(caseRow.opened_at)} />
                <Fact label="Started" value={formatStamp(caseRow.started_at)} />
                <Fact label={t("caseSubmittedOn")} value={formatStamp(caseRow.submitted_at ?? caseRow.completed_at)} />
                {/* Only meaningful while a sitting is still open — after
                    submission it is a timestamp for a draft that no longer exists. */}
                {caseRow.draft_updated_at && !caseRow.completed_at && (
                  <Fact label="Last autosave" value={formatStamp(caseRow.draft_updated_at)} />
                )}
              </dl>

              {caseRow.status === "completed" && caseRow.response_id && (
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/app/responses?r=${caseRow.response_id}`}>{t("caseViewResponse")}</Link>
                </Button>
              )}
            </div>
          </InspectorSection>

          {/* ── Follow-up ───────────────────────────────────────────────── */}
          <InspectorSection title="Follow-up">
            <FollowUpPanel caseRow={caseRow} onChanged={onChanged} />
          </InspectorSection>

          {/* ── Timeline ────────────────────────────────────────────────── */}
          <InspectorSection title={t("caseTimeline")}>
            {eventsPending ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-field" />
                ))}
              </div>
            ) : !events?.length ? (
              <p className="t-caption text-muted-foreground">Nothing has happened on this case yet.</p>
            ) : (
              /* The rail is a sibling of the <ol>, not a child: a bare <span>
                 between list items is invalid markup and assistive tech counts
                 it as a phantom entry. */
              <div className="relative">
                <span aria-hidden className="absolute bottom-2 left-[11px] top-2 w-px -translate-x-1/2 bg-border" />
                <ol className="space-y-4">
                  {events.map((ev) => {
                    const meta = EVENT_META[ev.event];
                    const Icon = meta?.icon ?? Circle;
                    return (
                      <li key={ev.id} className="relative pl-8">
                        <span className="absolute left-0 top-0 grid h-[22px] w-[22px] place-items-center rounded-pill border border-border bg-card text-muted-foreground">
                          <Icon className="h-3 w-3" strokeWidth={1.8} />
                        </span>
                        <div className="t-body font-medium leading-tight">{meta?.label ?? humanise(ev.event)}</div>
                        <div className="mt-0.5 t-caption text-tertiary">
                          {ev.actor} · {relativeTime(ev.created_at)}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}
          </InspectorSection>
        </div>
      </Inspector>

      {/* The paper the family keeps. Portalled to <body>, so "Print slip" and a
          plain Ctrl+P both print the slip rather than the console. */}
      <CaseSlipSheet caseRow={{ ...caseRow, access_token: token }} />

      <ConfirmDialog
        open={confirm === "link"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("caseRegenerateLink")}
        // Deliberately does NOT promise that live sessions end: regenerateLink()
        // rotates the case's access token, it does not revoke rows in
        // family_case_sessions, so a device already signed in stays signed in.
        // Telling an officer otherwise would be the one sentence on this panel
        // that could get a family's data seen by the wrong person.
        description="The old link and QR code stop working immediately — use this when a slip is lost or the QR has been seen by someone it should not have been. Anyone already signed in on their own device stays signed in until that sitting ends."
        confirmLabel={t("caseRegenerateLink")}
        icon={Link2}
        busy={busy}
        cancelLabel={t("cancel")}
        onConfirm={() =>
          void run(async () => {
            const next = await regenerateLink(caseRow.id);
            setMinted((m) => ({ ...(m && m.caseId === caseRow.id ? m : {}), caseId: caseRow.id, token: next }));
          }, "New secure link generated")
        }
      />

      <ConfirmDialog
        open={confirm === "reopen"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t("caseReopen")}
        description="The response already submitted is kept exactly as it is. A second sitting will be recorded as a separate response rather than overwriting the first."
        confirmLabel={t("caseReopen")}
        icon={RotateCcw}
        busy={busy}
        cancelLabel={t("cancel")}
        onConfirm={() => void run(() => reopenFamilyCase(caseRow.id, 30), "Case reopened for 30 days")}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete family case"
        description={t("caseDeleteConfirm")}
        confirmLabel="Delete"
        icon={Trash2}
        destructive
        busy={busy}
        cancelLabel={t("cancel")}
        onConfirm={() =>
          void run(async () => {
            await deleteFamilyCase(caseRow.id);
            onOpenChange(false);
          }, "Family case deleted")
        }
      />
    </>
  );
}

function Fact({
  label,
  value,
  mono,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="eyebrow">{label}</dt>
      <dd className={cn("mt-0.5 t-body leading-snug", mono && "font-mono tabular-nums")}>{value}</dd>
    </div>
  );
}

/**
 * One shape for every irreversible action in this panel. Each of them retires a
 * credential the family is already holding, so the dialog names that
 * consequence rather than asking "are you sure?".
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel,
  icon: Icon,
  busy,
  destructive,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  icon: LucideIcon;
  busy: boolean;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={busy}
            className={cn("gap-2", destructive && "bg-danger text-destructive-foreground hover:bg-danger/90")}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" strokeWidth={1.8} />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
