import { Sparkles } from "lucide-react";

import { LearnMaterialCard } from "@/components/learn/learn-material-card";
import type { LearnMaterialListItem } from "@/lib/learn/types";

type LearnFeaturedStripProps = {
  items: LearnMaterialListItem[];
};

export function LearnFeaturedStrip({ items }: LearnFeaturedStripProps) {
  if (!items.length) return null;

  return (
    <section className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="mb-1.5 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted md:mb-2 md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
            <Sparkles className="h-3.5 w-3.5 text-brand-ink" />
            Featured
          </div>
          <h2 className="text-xl font-semibold tracking-tight text-brand-ink md:text-2xl">Рекомендованные материалы</h2>
          <p className="mt-1 text-xs text-brand-muted md:text-sm">Стартовая подборка для регулярной практики и развития слуха.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3">
        {items.map((material, index) => (
          <div key={material.id} className={index === 0 ? "lg:col-span-2" : ""}>
            <LearnMaterialCard material={material} featured />
          </div>
        ))}
      </div>
    </section>
  );
}
