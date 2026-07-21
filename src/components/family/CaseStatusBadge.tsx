import { Badge } from "@/components/ui/badge";
import { useT, type DictKey } from "@/lib/i18n";
import type { FamilyCaseStatus } from "@/lib/familyCases";
import { cn } from "@/lib/utils";

/* Where a family case stands, at a glance, in an admin list of hundreds.

   The rule: colour carries urgency, never identity. Officers scan this column
   looking for what needs action today — `expired` must read as red from across
   the room, `completed` as settled — so the six statuses collapse into four
   tones rather than six decorative ones. `opened` and `reopened` share the
   primary tone deliberately: to an officer they mean the same thing, "the
   family has it, nothing is owed from you yet", and the label carries the
   distinction. */

/** Exported separately so list filters and stat tiles can label a status
    without pulling in the badge. */
export const CASE_STATUS_LABEL_KEYS: Record<FamilyCaseStatus, DictKey> = {
  not_started: "statusNotStarted",
  opened: "statusOpened",
  in_progress: "statusInProgress",
  completed: "statusCompleted",
  expired: "statusExpired",
  reopened: "statusReopened",
};

const TONE: Record<FamilyCaseStatus, string> = {
  not_started: "border-transparent bg-muted text-muted-foreground",
  opened: "border-transparent bg-accent-tint text-primary",
  in_progress: "border-transparent bg-[hsl(var(--warning)/0.14)] text-warning",
  completed: "border-transparent bg-[hsl(var(--success)/0.12)] text-success",
  expired: "border-transparent bg-[hsl(var(--danger)/0.12)] text-danger",
  reopened: "border-transparent bg-accent-tint text-primary",
};

export function CaseStatusBadge({
  status,
  className,
}: {
  status: FamilyCaseStatus;
  className?: string;
}) {
  const t = useT();

  return (
    <Badge variant="outline" className={cn(TONE[status], "rounded-pill font-medium", className)}>
      {/* bg-current so the dot inherits the tone and can never drift out of sync with it. */}
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-pill bg-current" />
      {t(CASE_STATUS_LABEL_KEYS[status])}
    </Badge>
  );
}
