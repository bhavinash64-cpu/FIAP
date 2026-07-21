import { Skeleton } from "@/components/ui/skeleton";

export function SurveyCardSkeleton() {
  return (
    <div className="rounded-surface border border-border p-6 space-y-3">
      <Skeleton className="h-4 w-20 rounded-pill" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/2" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}

export function QuestionCardSkeleton() {
  return (
    <div className="rounded-surface border border-border p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-2/3" />
    </div>
  );
}
