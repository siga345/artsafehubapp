"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { PathPage } from "@/components/home/path-page";
import { OverlayPortal } from "@/components/ui/overlay-portal";

type PathOverlayProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PathOverlayContextValue = {
  isPathOverlayOpen: boolean;
  openPathOverlay: () => void;
  closePathOverlay: () => void;
};

const PathOverlayContext = createContext<PathOverlayContextValue | null>(null);

export function PathOverlay({ open, onOpenChange }: PathOverlayProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <OverlayPortal>
      <div
        className="fixed inset-0 z-50 overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-md sm:px-6 sm:py-8"
        onClick={() => onOpenChange(false)}
        role="dialog"
        aria-modal="true"
        aria-label="PATH"
      >
        <div
          className="mx-auto flex min-h-full w-full max-w-[30rem] items-center justify-center sm:max-w-[34rem]"
          onClick={(event) => event.stopPropagation()}
        >
          <PathPage compact />
        </div>
      </div>
    </OverlayPortal>
  );
}

export function PathOverlayProvider({ children }: { children: ReactNode }) {
  const [isPathOverlayOpen, setIsPathOverlayOpen] = useState(false);

  return (
    <PathOverlayContext.Provider
      value={{
        isPathOverlayOpen,
        openPathOverlay: () => setIsPathOverlayOpen(true),
        closePathOverlay: () => setIsPathOverlayOpen(false)
      }}
    >
      {children}
      <PathOverlay open={isPathOverlayOpen} onOpenChange={setIsPathOverlayOpen} />
    </PathOverlayContext.Provider>
  );
}

export function usePathOverlay() {
  const context = useContext(PathOverlayContext);

  if (!context) {
    throw new Error("usePathOverlay must be used within a PathOverlayProvider");
  }

  return context;
}
