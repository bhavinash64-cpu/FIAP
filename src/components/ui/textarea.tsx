import * as React from "react";

import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        // text-base until `lg` for the same iOS focus-zoom reason as Input.
        "flex min-h-[88px] w-full rounded-field border border-border bg-sunken px-4 py-3 text-base ring-offset-background transition-[background-color,border-color,box-shadow] duration-base ease-out placeholder:text-tertiary hover:border-border-strong focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
