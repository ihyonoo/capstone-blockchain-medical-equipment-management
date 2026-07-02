import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "./utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-[1rem] font-semibold tracking-[-0.015em] transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-ring/80 focus-visible:ring-[4px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          "border border-transparent bg-primary text-primary-foreground shadow-[0_14px_28px_rgba(20,20,19,0.16)] hover:-translate-y-0.5 hover:bg-[#26231f]",
        destructive:
          "border border-transparent bg-destructive text-white shadow-[0_14px_28px_rgba(180,35,24,0.18)] hover:-translate-y-0.5 hover:bg-[#a61d13] focus-visible:ring-destructive/20",
        outline:
          "border border-[rgba(20,20,19,0.16)] bg-white/82 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] hover:-translate-y-0.5 hover:bg-white",
        secondary:
          "border border-transparent bg-secondary text-secondary-foreground hover:bg-[#e4d9d0]",
        ghost:
          "bg-transparent text-foreground shadow-none hover:bg-white/62",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5 py-2 has-[>svg]:px-4",
        sm: "h-9 gap-1.5 px-3.5 has-[>svg]:px-3",
        lg: "h-12 px-6 text-[1rem] has-[>svg]:px-5",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

const Button = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button"> &
    VariantProps<typeof buttonVariants> & {
      asChild?: boolean;
    }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
});

Button.displayName = "Button";

export { Button, buttonVariants };
