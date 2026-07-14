import { Badge } from "@/components/ui/badge";
import type { SurveyStatus } from "@/lib/surveys";
import { cn } from "@/lib/utils";

const CONFIG: Record<SurveyStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground border-transparent" },
  published: { label: "Published", className: "bg-success/15 text-success border-transparent" },
  closed: { label: "Closed", className: "bg-warning/15 text-warning border-transparent" },
};

export function StatusBadge({ status, className }: { status: SurveyStatus; className?: string }) {
  const c = CONFIG[status];
  return <Badge variant="outline" className={cn(c.className, "rounded-full font-medium", className)}>{c.label}</Badge>;
}
