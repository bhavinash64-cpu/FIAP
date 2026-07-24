import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { assignAssessments, type FamilyCaseRow } from "@/lib/familyCases";
import { renderBilingual, useLangMode } from "@/lib/i18n";
import { listSurveys } from "@/lib/surveys";

/*
   "This household should also do these, starting on the 3rd."

   The Follow-up panel above answers a different question — the SAME instrument
   repeated on a cadence. This one hands the family additional instruments, as
   many as the officer wants, opening on a date they pick.

   The rule that governs it: one tick-box is one case row. Each assignment gets
   its own link, its own slip and its own response, so a family's caseload is a
   list of real cases rather than a nested field — which is what makes "allot as
   many as I wish" cost nothing structurally.

   Duplicates are not an error. The database already refuses a second OPEN case
   for the same (family, instrument); ticking one the family is mid-way through
   simply reports it as skipped rather than losing the other four ticks.
*/

/** A bare date means midnight local — what an officer means by "from the 3rd". */
function startOfLocalDay(yyyyMmDd: string): string {
  return new Date(`${yyyyMmDd}T00:00:00`).toISOString();
}

function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export function AssignAssessmentsPanel({
  caseRow,
  onChanged,
}: {
  caseRow: FamilyCaseRow;
  onChanged: () => void;
}) {
  const mode = useLangMode();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [startsOn, setStartsOn] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: surveys, isLoading } = useQuery({
    queryKey: ["surveys", "assignable"],
    queryFn: listSurveys,
    staleTime: 60_000,
  });

  // Only published instruments can be answered, so only they can be handed out.
  const options = useMemo(() => (surveys ?? []).filter((s) => s.status === "published"), [surveys]);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!picked.size || saving) return;
    setSaving(true);
    try {
      const scheduledFor = startsOn ? startOfLocalDay(startsOn) : null;
      const { created, skipped } = await assignAssessments({
        from: caseRow,
        surveyIds: [...picked],
        scheduledFor,
      });

      if (created.length) {
        const when = scheduledFor ? ` · opens ${new Date(scheduledFor).toLocaleDateString()}` : "";
        toast.success(`Assigned ${created.length} assessment${created.length === 1 ? "" : "s"}${when}`);
      }
      // Reported, never swallowed: an officer who ticked five and got three
      // needs to know which two the family already has open.
      if (skipped.length) {
        toast.warning(
          `${skipped.length} skipped — ${skipped[0].reason}${skipped.length > 1 ? " (and others)" : ""}`,
        );
      }

      setPicked(new Set());
      setStartsOn("");
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign the assessments.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-4/5" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="t-caption text-muted-foreground">
        Hand this family more instruments. Each one becomes its own case with its own link and slip.
      </p>

      <div className="max-h-60 space-y-1 overflow-y-auto rounded-field border border-border p-1.5">
        {options.length === 0 && (
          <p className="px-2 py-3 t-caption text-muted-foreground">No published assessments yet.</p>
        )}
        {options.map((s) => {
          const title = renderBilingual(mode, s.title_en, s.title_te);
          const checked = picked.has(s.id);
          return (
            <label
              key={s.id}
              className="flex cursor-pointer items-start gap-2.5 rounded-control px-2 py-2 transition-colors hover:bg-muted"
            >
              <Checkbox checked={checked} onCheckedChange={() => toggle(s.id)} className="mt-0.5" />
              <span className="min-w-0">
                <span className="block truncate t-caption font-medium">{title.primary}</span>
                {title.secondary && (
                  <span className="block truncate t-caption text-muted-foreground">{title.secondary}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="assign-starts-on" className="flex items-center gap-1.5 t-caption font-medium">
          <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.8} />
          Opens on
        </label>
        <Input
          id="assign-starts-on"
          type="date"
          min={today()}
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
        <p className="t-caption text-muted-foreground">
          {startsOn
            ? "The family cannot open these before this date."
            : "Leave empty to make them available immediately."}
        </p>
      </div>

      <Button onClick={submit} disabled={!picked.size || saving} className="w-full">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" strokeWidth={2} />
        )}
        {saving ? "Assigning…" : `Assign ${picked.size || ""} assessment${picked.size === 1 ? "" : "s"}`.trim()}
      </Button>
    </div>
  );
}
