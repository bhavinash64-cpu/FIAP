import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Weight 550, illuminated lit-edge, calm press, quiet hover. Radius comes from
  // `shape` rather than this base string so a pill button is a first-class
  // variant instead of a `rounded-pill` override fighting the base class.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap t-body font-[550] tracking-[-0.01em] ring-offset-background transition-[transform,background-color,color,border-color,box-shadow] duration-base ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[hsl(var(--focus-ring)/0.35)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-[var(--highlight-top)] hover:bg-primary-hover active:bg-primary-active",
        destructive: "bg-danger text-destructive-foreground shadow-[var(--highlight-top)] hover:bg-danger/90",
        outline: "border border-border bg-surface text-foreground hover:bg-sunken hover:border-border-strong",
        secondary: "border border-border bg-surface text-foreground shadow-[var(--highlight-top)] hover:bg-sunken",
        ghost: "text-foreground hover:bg-sunken",
        link: "text-primary underline-offset-4 hover:underline",
      },
      // Every size clears 48x48 on touch and drops to the original desktop
      // value at `lg` (1024px) — the point where the finished desktop design
      // takes over. `sm` in particular is 48px on a phone: a control being
      // visually secondary is expressed by its variant, never by shrinking it
      // under the thumb.
      //
      // `xl` is the exception that does NOT collapse at lg: it is the single
      // full-width call to action on a guided-assessment stage, where the
      // control is the only thing on the screen and 56px is the point, not an
      // accommodation for touch.
      size: {
        default: "h-12 px-5 lg:h-11 lg:px-6",
        sm: "h-12 px-4 t-caption [&_svg]:size-4 lg:h-9 lg:px-3.5",
        lg: "h-[52px] px-6 text-base lg:h-12 lg:px-8",
        xl: "h-14 px-6 text-base",
        icon: "h-12 w-12 lg:h-11 lg:w-11",
      },
      shape: {
        control: "rounded-control",
        pill: "rounded-pill",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      shape: "control",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, shape, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, shape, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
