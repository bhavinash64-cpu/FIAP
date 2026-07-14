import { Skeleton } from "@/components/ui/skeleton";

export function SurveyCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border/70 p-5 space-y-3">
      <Skeleton className="h-4 w-20 rounded-full" />
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
    <div className="rounded-2xl border border-border/70 p-5 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-2/3" />
    </div>
  );
}
