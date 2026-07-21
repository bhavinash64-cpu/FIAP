import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[12px] font-medium leading-[1.4] tracking-[0.01em] transition-colors focus:outline-none focus:ring-[3px] focus:ring-[hsl(var(--focus-ring)/0.35)]",
  {
    variants: {
      variant: {
        default: "border-transparent bg-accent-tint text-primary",
        secondary: "border-transparent bg-sunken text-muted-foreground",
        outline: "border-border text-muted-foreground",
        success: "border-transparent bg-[hsl(var(--success)/0.12)] text-success",
        warning: "border-transparent bg-[hsl(var(--warning)/0.14)] text-warning",
        danger: "border-transparent bg-[hsl(var(--danger)/0.12)] text-danger",
        destructive: "border-transparent bg-[hsl(var(--danger)/0.12)] text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
