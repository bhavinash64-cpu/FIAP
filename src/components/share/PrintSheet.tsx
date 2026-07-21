import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Content that exists only on paper.
 *
 * Portalled to a direct child of <body> so the one print rule in index.css
 * (`body.printing > *:not(.print-sheet)`) can hide the rest of the app without
 * knowing anything about where this was rendered from. Trigger with
 * printSheetOnly() from lib/share.
 */
export function PrintSheet({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  // document.body isn't there during SSR or the first render pass.
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className="print-sheet hidden bg-white text-black print:block">{children}</div>,
    document.body,
  );
}
