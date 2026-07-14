import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function RatingStars({
  value,
  onChange,
  size = "md",
}: {
  value: number | null;
  onChange?: (v: number) => void;
  size?: "sm" | "md" | "lg";
}) {
  const px = { sm: "h-5 w-5", md: "h-8 w-8", lg: "h-10 w-10" }[size];
  return (
    <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = (value ?? 0) >= n;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            disabled={!onChange}
            onClick={() => onChange?.(n)}
            className={cn("transition-transform", onChange && "hover:scale-110 active:scale-95")}
          >
            <Star className={cn(px, filled ? "fill-warning text-warning" : "text-muted-foreground/40")} strokeWidth={1.5} />
          </button>
        );
      })}
    </div>
  );
}
