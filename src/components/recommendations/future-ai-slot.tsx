"use client";

import { Sparkles } from "lucide-react";

import type { RecommendationCard } from "@/contracts/recommendations";

type Props = {
  slot: RecommendationCard["futureAiSlot"];
};

export function FutureAiSlot({ slot }: Props) {
  if (!slot) return null;

  return (
    <div className="rounded-2xl border border-dashed border-brand-border bg-[#f7fbf2] p-3 text-sm text-brand-muted">
      <div className="flex items-center gap-2 font-medium text-brand-ink">
        <Sparkles className="h-4 w-4" />
        {slot.title}
      </div>
      <p className="mt-2">{slot.description}</p>
    </div>
  );
}
