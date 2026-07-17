import { create } from "zustand";
import { FileEdit, FileText, Mic } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { QuestionOrigin } from "@/lib/surveys";

interface OriginVisibilityState {
  visible: boolean;
  toggle: () => void;
}

export const useOriginVisibility = create<OriginVisibilityState>((set) => ({
  visible: (typeof window !== "undefined" && localStorage.getItem("apfap-show-origin") !== "0"),
  toggle: () => set((s) => {
    const next = !s.visible;
    if (typeof window !== "undefined") localStorage.setItem("apfap-show-origin", next ? "1" : "0");
    return { visible: next };
  }),
}));

const CONFIG: Record<QuestionOrigin, { label: string; icon: typeof FileEdit; className: string }> = {
  manual: { label: "Manual", icon: FileEdit, className: "bg-muted text-muted-foreground" },
  pdf: { label: "PDF", icon: FileText, className: "bg-accent text-primary" },
  voice: { label: "Voice", icon: Mic, className: "bg-success/15 text-success" },
};

export function OriginBadge({ origin }: { origin: QuestionOrigin }) {
  const visible = useOriginVisibility((s) => s.visible);
  if (!visible) return null;
  const c = CONFIG[origin];
  return (
    <Badge variant="secondary" className={`t-caption gap-1 border-transparent ${c.className}`}>
      <c.icon className="h-2.5 w-2.5" /> {c.label}
    </Badge>
  );
}
