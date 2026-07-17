import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-field border border-border bg-sunken px-4 text-base ring-offset-background transition-[background-color,border-color,box-shadow] duration-base ease-out file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-tertiary hover:border-border-strong focus-visible:border-primary focus-visible:bg-surface focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
