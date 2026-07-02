import * as React from "react";

import { cn } from "./utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "file:text-foreground placeholder:text-muted-foreground/85 selection:bg-accent selection:text-foreground border-input flex h-12 w-full min-w-0 rounded-[20px] border bg-input-background px-4 py-2.5 text-[1rem] tracking-[-0.01em] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] transition-[border-color,box-shadow,background-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:border-[rgba(184,91,34,0.46)] focus-visible:bg-white focus-visible:ring-[4px]",
        "aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
