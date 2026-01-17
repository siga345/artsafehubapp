import * as React from "react";

import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "w-full rounded-md border border-brand-border bg-white px-3 py-2 text-sm text-brand-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-accent",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";
