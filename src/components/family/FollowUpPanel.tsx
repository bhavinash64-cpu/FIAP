import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Loader2, Minus, Plus, Repeat2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CaseStatusBadge } from "@/components/family/CaseStatusBadge";
import { CASE_STATUSES, daysUntil, type FamilyCaseRow, type FamilyCaseStatus } from "@/lib/familyCases";
import {
  FOLLOWUP_INTERVALS,
  listFollowUpChain,
  readFollowUpPlan,
  setFollowUpPlan,
  type FollowUpPlan,
} from "@/lib/familyFollowups";
import { cn } from "@/lib/utils";

/*
   The longitudinal half of a family case: whether this household is answering
   the instrument once, or on a schedule.

   The rule that governs this panel: a round is never overwritten. Each
   administration is its own case row with its own token and its own response,
   so what an officer edits here is only the *schedule* — never the history. The
   chain below the control is therefore read-only by design, and it is fetched
   rather than inferred, because "round 2 of 3" printed from a single row is a
   claim; printed from the chain it is a fact.
*/

/** The sentinel the Select uses for "no schedule" — Radix forbids an empty value. */
const NO_FOLLOWUP = "none";

const MAX_ROUNDS = 6;

function asStatus(value: string): FamilyCaseStatus | null {
  return (CASE_STATUSES as string[]).includes(value) ? (value as FamilyCaseStatus) : null;
}

function formatDay(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  } catch {
    return new Date(iso).toLocaleDateString();
  }
}

export function FollowUpPanel({ caseRow, onChanged }: { caseRow: FamilyCaseRow; onChanged: () => void }) {
  const reduce = useReducedMotion();
  // Passed straight in, uncast: readFollowUpPlan widens its parameter precisely
  // so call sites do not have to, and it reads every schedule field defensively
  // because a deployment behind on this migration hands us a row without them.
  const plan = readFollowUpPlan(caseRow);

  const [intervalDays, setIntervalDays] = useState<number | null>(plan.intervalDays);
  const [roundsTotal, setRoundsTotal] = useState<number>(plan.roundsTotal);
  const [saving, setSaving] = useState(false);
  // What "saved" currently means. It advances on a successful write as well as
  // on a fresh row, because the caseload refetch lands a beat after the toast —
  // comparing the draft against the stale row in between would flash "Not saved
  // yet" immediately after telling the officer it was saved.
  const [baseline, setBaseline] = useState({ intervalDays: plan.intervalDays, roundsTotal: plan.roundsTotal });

  // Stepping to the next family with j/k reuses this component, so the draft
  // schedule has to be re-seeded from the row rather than left behind on it.
  useEffect(() => {
    setIntervalDays(plan.intervalDays);
    setRoundsTotal(plan.roundsTotal);
    setBaseline({ intervalDays: plan.intervalDays, roundsTotal: plan.roundsTotal });
  }, [caseRow.id, plan.intervalDays, plan.roundsTotal]);

  // The failure matters as much as the data: on a deployment whose database is
  // behind this migration the select below is a 42703, and a stepper drawn from
  // an empty chain would state that every earlier round is uncompleted — which
  // is the one thing this panel exists to not guess at.
  const { data: chain, isPending: chainPending, isError: chainFailed } = useQuery({
    queryKey: ["family-followup-chain", caseRow.id],
    queryFn: () => listFollowUpChain(caseRow.id),
  });

  // Rounds already administered cannot be un-scheduled: the rows exist. The
  // floor is therefore the round this case sits in, not 1.
  const minRounds = Math.max(1, plan.round);
  const scheduled = intervalDays != null;
  const dirty = intervalDays !== baseline.intervalDays || roundsTotal !== baseline.roundsTotal;

  const completedRounds = useMemo(() => {
    const set = new Set<number>();
    for (const entry of chain ?? []) {
      if (entry.status === "completed") set.add(entry.followup_round);
    }
    return set;
  }, [chain]);

  // The series is as long as the plan says, unless the chain has already run
  // past it — an officer who shortened the schedule should still see the rounds
  // that exist.
  const chainMax = (chain ?? []).reduce((max, entry) => Math.max(max, entry.followup_round), 0);
  const seriesLength = Math.max(plan.roundsTotal, plan.round, chainMax, 1);
  const showStepper = seriesLength > 1;

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      const next = scheduled ? Math.max(minRounds, roundsTotal) : 1;
      await setFollowUpPlan(caseRow.id, { intervalDays, roundsTotal: next });
      setRoundsTotal(next);
      setBaseline({ intervalDays, roundsTotal: next });
      const cadence = FOLLOWUP_INTERVALS.find((o) => o.days === intervalDays)?.label;
      toast.success(
        intervalDays == null
          ? "Follow-up schedule removed"
          : `Follow-up set — ${(cadence ?? `every ${intervalDays} days`).toLowerCase()}, ${next} ${next === 1 ? "round" : "rounds"}`,
      );
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the follow-up schedule.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Where this case sits in the series ─────────────────────────── */}
      {showStepper && (
        <div className="rounded-surface border border-border/70 bg-sunken/50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Repeat2 className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.7} />
            <span className="t-body font-medium">
              Round {plan.round} of {seriesLength}
            </span>
            {/* Decorative: "Round 2 of 3" is already read out beside it, and the
                completions it encodes are listed in full below. Announcing the
                dots as well would be the same fact three times. */}
            <ol aria-hidden className="ml-auto flex items-center gap-1.5">
              {Array.from({ length: seriesLength }, (_, i) => i + 1).map((round) => {
                const done = completedRounds.has(round);
                const current = round === plan.round;
                return (
                  <li
                    key={round}
                    title={
                      done
                        ? `Round ${round} — completed`
                        : current
                          ? `Round ${round} — this case`
                          : chainFailed
                            ? `Round ${round} — could not be loaded`
                            : `Round ${round} — not yet created`
                    }
                    className={cn(
                      "h-2.5 w-2.5 rounded-pill border",
                      done
                        ? "border-success bg-success"
                        : current
                          ? "border-primary bg-primary-tint ring-2 ring-[hsl(var(--primary)/0.25)]"
                          : "border-border-strong bg-transparent",
                    )}
                  />
                );
              })}
            </ol>
          </div>

          <DueLine plan={plan} status={caseRow.status} seriesLength={seriesLength} />

          {chainFailed && (
            <p className="mt-2 t-caption text-muted-foreground">
              The earlier rounds could not be loaded, so only this round&rsquo;s place in the series is certain.
            </p>
          )}
        </div>
      )}

      {/* ── The schedule control ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
        <div className="min-w-[13rem] flex-1">
          <label className="eyebrow" htmlFor={`followup-interval-${caseRow.id}`}>
            Repeat
          </label>
          <Select
            value={intervalDays == null ? NO_FOLLOWUP : String(intervalDays)}
            onValueChange={(v) => setIntervalDays(v === NO_FOLLOWUP ? null : Number(v))}
          >
            <SelectTrigger id={`followup-interval-${caseRow.id}`} className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_FOLLOWUP}>No follow-up</SelectItem>
              {FOLLOWUP_INTERVALS.map((option) => (
                <SelectItem key={option.days} value={String(option.days)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <span className="eyebrow" id={`followup-rounds-${caseRow.id}`}>
            Rounds
          </span>
          <div
            role="group"
            aria-labelledby={`followup-rounds-${caseRow.id}`}
            className="mt-1.5 flex h-12 items-center gap-1 rounded-field border border-border bg-card px-1 lg:h-11"
          >
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 lg:h-9 lg:w-9"
              aria-label="One fewer round"
              disabled={!scheduled || roundsTotal <= minRounds}
              onClick={() => setRoundsTotal((n) => Math.max(minRounds, n - 1))}
            >
              <Minus className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
            <span
              aria-live="polite"
              className={cn(
                "w-6 text-center t-body font-semibold tabular-nums",
                !scheduled && "text-tertiary",
              )}
            >
              {scheduled ? roundsTotal : 1}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-9 w-9 lg:h-9 lg:w-9"
              aria-label="One more round"
              disabled={!scheduled || roundsTotal >= MAX_ROUNDS}
              onClick={() => setRoundsTotal((n) => Math.min(MAX_ROUNDS, n + 1))}
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={1.8} />
            </Button>
          </div>
        </div>

        <Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" strokeWidth={1.7} />}
          Save schedule
        </Button>
      </div>

      {/* Unsaved edits are the one state an officer can misread as done, so the
          panel says so in words rather than relying on the enabled button. */}
      {dirty && !saving && (
        <motion.p
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="t-caption text-warning"
        >
          Not saved yet.
        </motion.p>
      )}

      {!showStepper && !dirty && (
        <p className="t-caption text-muted-foreground">
          {scheduled
            ? "A cadence is set but the series is one round long — add a round above for it to have anything to create."
            : "One-off case. Set a repeat above to re-administer this assessment to the same family later."}
        </p>
      )}

      {/* ── The chain ──────────────────────────────────────────────────── */}
      {chainPending ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-field" />
          ))}
        </div>
      ) : (chain?.length ?? 0) > 1 ? (
        <ol className="divide-y divide-border/70 overflow-hidden rounded-field border border-border/70">
          {(chain ?? []).map((entry) => {
            const status = asStatus(entry.status);
            return (
              <li
                key={entry.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2",
                  entry.id === caseRow.id && "bg-accent-tint/60",
                )}
              >
                <span className="t-caption font-semibold tabular-nums text-muted-foreground">
                  R{entry.followup_round}
                </span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs tracking-wide">
                  {entry.reference_id}
                </span>
                {status ? (
                  <CaseStatusBadge status={status} />
                ) : (
                  <span className="t-caption text-tertiary">{entry.status}</span>
                )}
                <span className="t-caption tabular-nums text-tertiary">{formatDay(entry.completed_at)}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}

/**
 * When the next round arrives, in the words an officer would use.
 *
 * A null `dueAt` is left as a null: the scheduler stamps it, and guessing a date
 * from the interval would put a number on screen the system has not committed to.
 */
function DueLine({
  plan,
  status,
  seriesLength,
}: {
  plan: FollowUpPlan;
  status: FamilyCaseStatus;
  seriesLength: number;
}) {
  if (plan.intervalDays == null) return null;

  if (plan.round >= seriesLength) {
    return <p className="mt-2 t-caption text-muted-foreground">Final round — the series ends here.</p>;
  }

  if (status !== "completed") {
    return (
      <p className="mt-2 t-caption text-muted-foreground">
        The next round is scheduled once this one is completed.
      </p>
    );
  }

  if (!plan.dueAt) {
    return (
      <p className="mt-2 t-caption text-muted-foreground">
        The next round has no due date recorded yet.
      </p>
    );
  }

  const days = daysUntil(plan.dueAt);
  return (
    <p className={cn("mt-2 t-caption font-medium", days > 0 ? "text-muted-foreground" : "text-primary")}>
      {days > 0
        ? `Next round due in ${days} ${days === 1 ? "day" : "days"}.`
        : "Due now — it will be created automatically."}
    </p>
  );
}
