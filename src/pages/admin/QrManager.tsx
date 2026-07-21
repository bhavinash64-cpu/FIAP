import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { QrCode, Loader2, ClipboardList, Inbox, Eye, CheckCircle2, BarChart3, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/admin/PageContainer";
import { SurveyShareCard } from "@/components/share/SurveyShareCard";
import { listSurveys, type SurveyWithCounts } from "@/lib/surveys";
import { getSurveyStats, type SurveyStats } from "@/lib/analytics";
import { useLangMode, useT, renderBilingual } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Distribution + a read on how it's landing, on one full-width page.
 *
 * A published survey's slug IS its access credential, so this is the only place
 * the link is minted into something a family can act on. The right column pairs
 * that share surface with the survey's live reach (opens, responses, completion)
 * so "how do I share this" and "is anyone answering" are answered together,
 * stacked on one grid rather than floating at different widths.
 */
export default function QrManager() {
  const t = useT();
  const mode = useLangMode();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: surveys, isLoading } = useQuery({ queryKey: ["surveys"], queryFn: listSurveys });

  const shareable = useMemo(
    () => (surveys ?? []).filter((s) => s.status === "published" && s.slug),
    [surveys],
  );

  useEffect(() => {
    if (shareable.length && !shareable.some((s) => s.id === selectedId)) {
      setSelectedId(shareable[0].id);
    }
  }, [shareable, selectedId]);

  const selected = shareable.find((s) => s.id === selectedId) ?? null;

  return (
    <PageContainer>
      <PageHeader eyebrow={t("navGroupSurveys")} title={t("qrTitle")} subtitle={t("qrSubtitle")} />

      {isLoading ? (
        <div className="mt-16 grid place-items-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" strokeWidth={1.5} />
          <span className="sr-only">{t("loading")}</span>
        </div>
      ) : !shareable.length ? (
        <div className="mt-8 rounded-surface border border-dashed border-border p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-pill bg-accent-tint">
            <QrCode className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <h2 className="mt-6 t-section">{t("qrNoPublished")}</h2>
          <p className="mx-auto mt-2 max-w-sm t-body text-muted-foreground">{t("qrNoPublishedBody")}</p>
          <Button asChild variant="outline" className="mt-6">
            <Link to="/app/surveys">
              <ClipboardList strokeWidth={1.5} />
              {t("navSurveys")}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
          <nav aria-label={t("navSurveys")} className="grid content-start gap-2.5">
            <div className="eyebrow px-0.5">{t("navSurveys")}</div>
            {shareable.map((s) => (
              <SurveyPickerCard
                key={s.id}
                survey={s}
                title={renderBilingual(mode, s.title_en, s.title_te).primary}
                active={s.id === selectedId}
                onSelect={() => setSelectedId(s.id)}
              />
            ))}
          </nav>

          {selected ? (
            <div className="grid min-w-0 gap-6">
              <SurveyShareCard key={selected.id} survey={selected} mode={mode} />
              <ReachStats survey={selected} />
            </div>
          ) : (
            <div className="grid place-items-center rounded-surface border border-dashed border-border p-12 text-center t-body text-muted-foreground">
              {t("qrSelectPrompt")}
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

/**
 * One survey in the picker.
 *
 * Every card is the same height whatever the title length — `min-h` plus a
 * two-line clamp, so a one-word survey and a wrapping bilingual title produce
 * the same block. Selection is carried by four signals at once (brand border,
 * tinted fill, a spring-animated rail that slides between cards, and a filled
 * tick) because the previous single-border treatment was genuinely hard to spot
 * against the warm canvas.
 */
function SurveyPickerCard({
  survey,
  title,
  active,
  onSelect,
}: {
  survey: SurveyWithCounts;
  title: string;
  active: boolean;
  onSelect: () => void;
}) {
  const reduce = useReducedMotion();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative flex min-h-[92px] w-full flex-col justify-between overflow-hidden rounded-surface border px-4 py-3.5 text-left",
        "transition-[background-color,border-color,box-shadow,transform] duration-base ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-primary/45 bg-accent shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]"
          : "border-border/70 bg-card hover:-translate-y-px hover:border-primary/40 hover:bg-muted/40 hover:shadow-sm",
      )}
    >
      {active && !reduce && (
        <motion.span
          layoutId="qr-picker-rail"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="absolute inset-y-2 left-0 w-[3px] rounded-pill bg-primary"
        />
      )}
      {active && reduce && <span className="absolute inset-y-2 left-0 w-[3px] rounded-pill bg-primary" />}

      <span className="flex items-start gap-2 pl-1.5">
        <span className={cn("line-clamp-2 min-w-0 flex-1 t-card leading-snug", active && "text-primary")}>{title}</span>
        <span
          aria-hidden
          className={cn(
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-pill border-2 transition-colors duration-fast",
            active ? "border-primary bg-primary" : "border-border",
          )}
        >
          {active && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3} />}
        </span>
      </span>

      <span className="mt-2 flex items-center gap-3 pl-1.5 t-caption text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="tabular-nums">{survey.question_count}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Inbox className="h-3.5 w-3.5" strokeWidth={1.8} />
          <span className="tabular-nums">{survey.response_count}</span>
        </span>
      </span>
    </button>
  );
}

/** Live reach for the selected survey — the "analyse" half of the page. */
function ReachStats({ survey }: { survey: SurveyWithCounts }) {
  const t = useT();
  const { data: stats, isPending } = useQuery<SurveyStats>({
    queryKey: ["survey-stats", survey.id],
    queryFn: () => getSurveyStats(survey.id),
  });

  const completion = stats?.completionRate != null ? `${Math.round(stats.completionRate * 100)}%` : "—";

  const tiles = [
    { icon: Eye, label: t("qrOpens"), value: stats ? String(stats.totalViews) : "—" },
    { icon: Inbox, label: t("navResponses"), value: stats ? String(stats.totalResponses) : String(survey.response_count) },
    { icon: CheckCircle2, label: t("qrCompletion"), value: completion },
  ];

  return (
    <section className="rounded-surface border border-border/70 bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="eyebrow">{t("qrReach")}</h2>
        <Button asChild variant="ghost" size="sm" className="-mr-2 gap-1.5 text-muted-foreground hover:text-foreground">
          <Link to={`/app/surveys/${survey.id}/analytics`}>
            <BarChart3 className="h-4 w-4" strokeWidth={1.7} />
            {t("navAnalytics")}
          </Link>
        </Button>
      </div>

      {/* Three equal cells on the same grid as the action buttons above, so the
          card reads as one object rather than two stacked panels. */}
      <dl className="mt-3 grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-field border border-border/60 bg-canvas p-3.5">
            <dt className="flex items-center gap-1.5 t-caption text-muted-foreground">
              <tile.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.7} />
              <span className="truncate">{tile.label}</span>
            </dt>
            <dd className={cn("mt-1.5 t-title tabular-nums leading-none", isPending && "animate-pulse text-muted-foreground")}>
              {tile.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
