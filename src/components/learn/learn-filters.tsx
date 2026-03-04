"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getLearnProgressStatusLabel } from "@/lib/learn/providers";
import type { LearnProgressStatus } from "@/lib/learn/types";
import { cn } from "@/lib/utils";

export type LearnCatalogTypeFilter = "ALL" | "VIDEO" | "ARTICLE";
export type LearnCatalogStatusFilter = "ALL" | LearnProgressStatus;

type LearnFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  selectedType: LearnCatalogTypeFilter;
  onTypeChange: (value: LearnCatalogTypeFilter) => void;
  selectedStatus: LearnCatalogStatusFilter;
  onStatusChange: (value: LearnCatalogStatusFilter) => void;
  selectedTag: string | null;
  onTagChange: (value: string | null) => void;
  availableTags: string[];
  resultCount: number;
  onReset: () => void;
  variant?: "standalone" | "embedded";
};

const typeOptions: Array<{ value: LearnCatalogTypeFilter; label: string }> = [
  { value: "ALL", label: "Все" },
  { value: "VIDEO", label: "Видео" },
  { value: "ARTICLE", label: "Статьи" }
];

const statusOptions: Array<{ value: LearnCatalogStatusFilter; label: string }> = [
  { value: "ALL", label: "Все" },
  { value: "OPEN", label: getLearnProgressStatusLabel("OPEN") },
  { value: "APPLIED", label: getLearnProgressStatusLabel("APPLIED") },
  { value: "NOT_RELEVANT", label: getLearnProgressStatusLabel("NOT_RELEVANT") },
  { value: "LATER", label: getLearnProgressStatusLabel("LATER") }
];

export function LearnFilters({
  search,
  onSearchChange,
  selectedType,
  onTypeChange,
  selectedStatus,
  onStatusChange,
  selectedTag,
  onTagChange,
  availableTags,
  resultCount,
  onReset,
  variant = "standalone"
}: LearnFiltersProps) {
  const hasActiveFilters = Boolean(search.trim() || selectedType !== "ALL" || selectedStatus !== "ALL" || selectedTag);
  const [showMobileTags, setShowMobileTags] = useState(false);
  const outerClassName =
    variant === "embedded"
      ? "rounded-xl border border-brand-border bg-white/75 p-2.5 shadow-sm backdrop-blur-sm md:rounded-2xl md:p-3"
      : "rounded-[22px] border border-brand-border bg-white/80 p-3 shadow-[0_12px_30px_rgba(55,74,61,0.08)] backdrop-blur-sm md:rounded-[28px] md:p-5";

  return (
    <section className={outerClassName}>
      {hasActiveFilters ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 md:mb-4">
          <Button type="button" variant="secondary" className="h-9 rounded-xl px-3 text-sm md:h-10" onClick={onReset}>
            <X className="h-4 w-4" />
            Сбросить фильтры
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 md:gap-4">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Поиск по темам, авторам, тегам..."
            className="h-10 bg-white pl-9 md:h-11"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap gap-2">
              {typeOptions.map((option) => {
                const active = selectedType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onTypeChange(option.value)}
                    className={cn(
                      "w-fit shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A342C] md:px-3 md:py-2",
                      active
                        ? "border-[#2A342C] bg-[#2A342C] text-white"
                        : "border-brand-border bg-white text-brand-ink hover:bg-[#eff4e7]"
                    )}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => {
                const active = selectedStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onStatusChange(option.value)}
                    className={cn(
                      "w-fit shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-sm font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A342C] md:px-3 md:py-2",
                      active
                        ? "border-[#2A342C] bg-[#2A342C] text-white"
                        : "border-brand-border bg-white text-brand-ink hover:bg-[#eff4e7]"
                    )}
                    aria-pressed={active}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center md:justify-end">
            <div className="inline-flex items-center rounded-lg border border-brand-border bg-white/85 px-2.5 py-1 text-[11px] text-brand-muted shadow-sm md:rounded-xl md:px-3 md:py-1.5 md:text-xs">
              Найдено: <span className="ml-1 font-semibold text-brand-ink">{resultCount}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 md:hidden">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-xl border border-brand-border bg-[#f7fbf2] px-3 py-2 text-left"
          onClick={() => setShowMobileTags((prev) => !prev)}
          aria-expanded={showMobileTags}
        >
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted">Tags</span>
          <span className="inline-flex items-center gap-1 text-xs text-brand-muted">
            {selectedTag ? `#${selectedTag}` : "все"}
            {showMobileTags ? <ChevronUp className="h-4 w-4 text-brand-ink" /> : <ChevronDown className="h-4 w-4 text-brand-ink" />}
          </span>
        </button>
      </div>

      <div className={`mt-3 flex flex-wrap gap-2 md:mt-4 ${showMobileTags ? "flex" : "hidden md:flex"}`}>
        {availableTags.map((tag) => {
          const active = selectedTag === tag;
          return (
            <button
              key={tag}
              type="button"
              onClick={() => onTagChange(active ? null : tag)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2A342C] md:px-3 md:py-1.5 md:text-xs",
                active
                  ? "border-[#2A342C] bg-[#2A342C] text-white"
                  : "border-brand-border bg-white text-brand-muted hover:text-brand-ink"
              )}
              aria-pressed={active}
            >
              #{tag}
            </button>
          );
        })}
      </div>
    </section>
  );
}
