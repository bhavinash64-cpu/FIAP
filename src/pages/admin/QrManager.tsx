import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { QrCode, Loader2, ClipboardList, Inbox, Eye, CheckCircle2, BarChart3 } from "lucide-react";
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
 * the link is minted into something a family can act on. The right pane pairs
 * that share surface with the survey's live reach (views, responses, completion)
 * so "how do I share this" and "is anyone answering" are answered together.
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
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <nav aria-label={t("navSurveys")} className="grid content-start gap-1.5">
            {shareable.map((s) => {
              const title = renderBilingual(mode, s.title_en, s.title_te).primary;
              const active = s.id === selectedId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "rounded-surface border px-4 py-3 text-left transition-colors duration-fast",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    active
                      ? "border-primary/40 bg-accent"
                      : "border-border/70 bg-card hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <span className={cn("line-clamp-2 t-card leading-snug", active && "text-primary")}>{title}</span>
                  <span className="mt-1 flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardList className="h-3 w-3" strokeWidth={1.8} />
                      {s.question_count}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Inbox className="h-3 w-3" strokeWidth={1.8} />
                      {s.response_count}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {selected ? (
            <div className="min-w-0 space-y-6">
              <ReachStats survey={selected} />
              <SurveyShareCard key={selected.id} survey={selected} mode={mode} />
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

/** Live reach for the selected survey — the "analyse" half of the page. */
function ReachStats({ survey }: { survey: SurveyWithCounts }) {
  const t = useT();
  const { data: stats } = useQuery<SurveyStats>({
    queryKey: ["survey-stats", survey.id],
    queryFn: () => getSurveyStats(survey.id),
  });

  const completion =
    stats?.completionRate != null ? `${Math.round(stats.completionRate * 100)}%` : "—";

  const tiles = [
    { icon: Eye, label: "Opens", value: stats ? String(stats.totalViews) : "—" },
    { icon: Inbox, label: t("navResponses"), value: stats ? String(stats.totalResponses) : String(survey.response_count) },
    { icon: CheckCircle2, label: "Completion", value: completion },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-surface border border-border/70 bg-card p-4">
          <span className="grid h-9 w-9 place-items-center rounded-control bg-accent-tint text-primary">
            <tile.icon className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </span>
          <div className="mt-3 t-title tabular-nums leading-none">{tile.value}</div>
          <div className="mt-1.5 t-caption text-muted-foreground">{tile.label}</div>
        </div>
      ))}
      <div className="col-span-3">
        <Button asChild variant="outline" size="sm">
          <Link to={`/app/surveys/${survey.id}/analytics`}>
            <BarChart3 strokeWidth={1.6} />
            {t("navAnalytics")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
