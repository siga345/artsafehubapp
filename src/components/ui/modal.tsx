"use client";

import { type ReactNode, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { OverlayPortal } from "@/components/ui/overlay-portal";
import { cn } from "@/lib/utils";

type ModalAction = {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  disabled?: boolean;
};

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: ReactNode;
  actions?: ModalAction[];
  closeOnBackdrop?: boolean;
  widthClassName?: string;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  actions = [],
  closeOnBackdrop = true,
  widthClassName
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-3 pt-16 backdrop-blur-sm md:items-center md:p-6"
        onClick={closeOnBackdrop ? onClose : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className={cn(
            "w-full rounded-3xl border border-brand-border bg-[#f7fbf2] p-4 shadow-[0_20px_60px_rgba(24,32,27,0.22)]",
            widthClassName ?? "max-w-md"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <h3 className="text-lg font-semibold text-brand-ink">{title}</h3>
          {description ? <p className="mt-2 text-sm text-brand-muted">{description}</p> : null}
          {children ? <div className="mt-3">{children}</div> : null}
          {actions.length ? (
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {actions.map((action, index) => (
                <Button
                  key={`${action.label}:${index}`}
                  variant={action.variant ?? "secondary"}
                  disabled={action.disabled}
                  onClick={action.onClick}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  );
}
