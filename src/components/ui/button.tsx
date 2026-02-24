import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = {
  base: "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-55",
  primary: "bg-[#2A342C] text-white hover:bg-[#1F2822]",
  secondary: "border border-brand-border bg-white text-brand-ink hover:bg-[#f2f5eb]",
  ghost: "text-brand-ink hover:bg-[#eef3e6]"
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
