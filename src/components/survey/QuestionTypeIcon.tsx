import { CircleDot, CheckSquare, SlidersHorizontal, ThumbsUp, Star, Type, AlignLeft, ChevronDown, type LucideIcon } from "lucide-react";
import type { QuestionKind } from "@/lib/surveys";

export const QUESTION_TYPE_ICON: Record<QuestionKind, LucideIcon> = {
  multiple_choice: CircleDot,
  checkboxes: CheckSquare,
  likert5: SlidersHorizontal,
  yes_no: ThumbsUp,
  rating5: Star,
  short_text: Type,
  long_text: AlignLeft,
  dropdown: ChevronDown,
};

export function QuestionTypeIcon({ kind, className }: { kind: QuestionKind; className?: string }) {
  const Icon = QUESTION_TYPE_ICON[kind];
  return <Icon className={className} />;
}
