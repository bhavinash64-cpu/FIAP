import { renderBilingual, type LangMode } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Renders authored content (title / prompt / option label) for the active
 * language mode. In single-language modes it shows exactly one line; in "both"
 * mode it shows Telugu primary + English secondary, and only when a real,
 * distinct translation exists — so text is never duplicated.
 */
export function BilingualText({
  mode,
  en,
  te,
  className,
  secondaryClassName,
  as: Tag = "span",
}: {
  mode: LangMode;
  en: string;
  te?: string | null;
  className?: string;
  secondaryClassName?: string;
  as?: "span" | "div" | "p" | "h1" | "h2" | "h3";
}) {
  const { primary, secondary } = renderBilingual(mode, en, te);
  return (
    <Tag className={className}>
      <span>{primary}</span>
      {secondary && (
        <span className={cn("mt-0.5 block font-normal text-muted-foreground", secondaryClassName)}>
          {secondary}
        </span>
      )}
    </Tag>
  );
}
