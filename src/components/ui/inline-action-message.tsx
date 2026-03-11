import { type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type InlineActionMessageProps = {
  variant?: "error" | "success" | "info";
  message: ReactNode;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
};

const variantClasses: Record<NonNullable<InlineActionMessageProps["variant"]>, string> = {
  error: "border-[#d88b80] bg-[#f2d7d0] text-[#6f1f17] shadow-[0_8px_20px_rgba(111,31,23,0.08)]",
  success: "border-emerald-300/45 bg-emerald-500/10 text-emerald-800",
  info: "border-brand-border bg-white/70 text-brand-muted"
};

export function InlineActionMessage({
  variant = "error",
  message,
  retryLabel = "Повторить",
  onRetry,
  className
}: InlineActionMessageProps) {
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-sm", variantClasses[variant], className)}>
      <div className="flex items-center justify-between gap-3">
        <div>{message}</div>
        {onRetry ? (
          <Button variant="secondary" className="h-8 rounded-lg px-3 text-xs" onClick={onRetry}>
            {retryLabel}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
