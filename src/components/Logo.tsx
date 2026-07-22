import logoUrl from "@/assets/logo.png";
import { cn } from "@/lib/utils";

/**
 * The PsyDigiHealth logo — the single approved artwork, used everywhere.
 *
 * The source is a square, high-resolution PNG on a white ground. It is used
 * exactly as provided: never stretched (always 1:1), never recoloured, never
 * cropped, never shadowed, and the artwork itself is never rounded. When a
 * surface needs a defined edge, the logo sits inside a clean rounded container
 * whose corners only ever clip the artwork's own white margin — the container
 * is rounded, the artwork is not.
 *
 * Displaying the ~1254px source at 32–52px means the browser always downscales,
 * so it stays crisp on high-DPI/Retina screens.
 */
export function Logo({
  size = 40,
  className,
  /** Wrap in a clean rounded white chip. Off = bare artwork. */
  container = true,
  /** Container corner radius; defaults to a soft proportion of the size. */
  radius,
  alt = "PsyDigiHealth",
}: {
  size?: number;
  className?: string;
  container?: boolean;
  radius?: number;
  alt?: string;
}) {
  const img = (
    <img
      src={logoUrl}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      decoding="async"
      className="h-full w-full select-none object-contain"
    />
  );

  if (!container) {
    return (
      <span className={cn("inline-block shrink-0", className)} style={{ width: size, height: size }}>
        {img}
      </span>
    );
  }

  return (
    <span
      className={cn("inline-grid shrink-0 place-items-center overflow-hidden bg-white", className)}
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.26) }}
    >
      {img}
    </span>
  );
}
