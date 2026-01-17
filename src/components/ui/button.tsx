import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = {
  base: "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
  primary: "bg-brand-ink text-white hover:bg-slate-900",
  secondary: "border border-brand-border bg-white text-brand-ink hover:bg-slate-50",
  ghost: "text-brand-ink hover:bg-slate-100"
};

export type ButtonVariant = keyof typeof buttonVariants;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants.base, buttonVariants[variant], className)}
      {...props}
    />
  )
);
Button.displayName = "Button";
