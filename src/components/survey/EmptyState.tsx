import type { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="py-16 px-6 flex flex-col items-center text-center">
      <div className="h-14 w-14 rounded-2xl bg-accent grid place-items-center mb-4">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div className="font-semibold">{title}</div>
      {body && <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
