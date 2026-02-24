import * as React from "react";

import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "w-full rounded-xl border border-brand-border bg-white px-3 py-2 text-sm text-brand-ink shadow-sm placeholder:text-brand-muted/80 focus:outline-none focus:ring-2 focus:ring-[#2A342C]",
      className
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
