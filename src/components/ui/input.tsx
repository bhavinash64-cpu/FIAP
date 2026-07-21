import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // text-base until `lg`: iOS Safari force-zooms the viewport on focus
          // for any field under 16px, and that zoom never animates back out.
          // The old `md:text-sm` dropped to 14px at 768 and re-armed it on iPad.
          "flex h-12 w-full rounded-field border border-border bg-sunken px-4 text-base ring-offset-background transition-[background-color,border-color,box-shadow] duration-base ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-tertiary hover:border-border-strong focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] disabled:cursor-not-allowed disabled:opacity-50 lg:h-11 lg:text-sm",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
