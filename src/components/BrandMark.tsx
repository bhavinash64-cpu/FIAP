/**
 * Jeevana Insight brand mark — three intersecting circles.
 * Understanding · insight · humanity. One definition, used everywhere.
 */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} fill="none" aria-hidden>
      <circle cx="16" cy="15" r="10" fill="hsl(var(--primary))" fillOpacity="0.9" style={{ mixBlendMode: "multiply" }} />
      <circle cx="24" cy="15" r="10" fill="hsl(var(--accent-lavender))" fillOpacity="0.9" style={{ mixBlendMode: "multiply" }} />
      <circle cx="20" cy="24" r="10" fill="hsl(var(--primary) / 0.7)" fillOpacity="0.85" style={{ mixBlendMode: "multiply" }} />
    </svg>
  );
}
