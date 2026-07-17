import { forwardRef, useCallback, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Borderless textarea that grows to fit its content — the inline-editing
 * primitive for the builder. Height is set on the DOM node directly rather than
 * through state, so typing never triggers a React render just to resize.
 */
export const AutoTextarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function AutoTextarea({ className, value, onChange, ...props }, forwardedRef) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;
      if (typeof forwardedRef === "function") forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const resize = useCallback(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  // Layout effect so the first paint is already the right height (no flash).
  useLayoutEffect(resize, [value, resize]);

  return (
    <textarea
      ref={setRef}
      rows={1}
      value={value}
      onChange={(e) => {
        resize();
        onChange?.(e);
      }}
      className={cn(
        "w-full resize-none overflow-hidden bg-transparent outline-none",
        "placeholder:text-muted-foreground/60",
        className,
      )}
      {...props}
    />
  );
});
