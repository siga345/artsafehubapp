"use client";

import { useDeferredValue, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";

import { LearnFeaturedStrip } from "@/components/learn/learn-featured-strip";
import {
  LearnFilters,
  type LearnCatalogTypeFilter
} from "@/components/learn/learn-filters";
import { LearnMaterialCard } from "@/components/learn/learn-material-card";
import { Button } from "@/components/ui/button";
import { apiFetchJson } from "@/lib/client-fetch";
import { filterLearnMaterials } from "@/lib/learn/filtering";
import type { LearnCatalogQuery, LearnCatalogResponse } from "@/lib/learn/types";

async function fetchLearnCatalog() {
  return apiFetchJson<LearnCatalogResponse>("/api/learn/materials");
}

export function LearnCatalogPage() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<LearnCatalogTypeFilter>("ALL");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  const catalogQuery = useQuery({
    queryKey: ["learn-materials-catalog"],
    queryFn: fetchLearnCatalog
  });

  const allItems = catalogQuery.data?.items ?? [];
  const filterQuery: LearnCatalogQuery = {
    q: deferredSearch.trim() || undefined,
    type: selectedType === "ALL" ? undefined : selectedType,
    tag: selectedTag ?? undefined
  };
  const filteredItems = filterLearnMaterials(allItems, filterQuery);
  const hasActiveFilters = Boolean(filterQuery.q || filterQuery.type || filterQuery.tag);

  const featuredItems = !hasActiveFilters
    ? [...filteredItems].filter((item) => item.isFeatured).slice(0, 4)
    : [];

  const gridItems = hasActiveFilters
    ? filteredItems
    : filteredItems.filter((item) => !featuredItems.some((featured) => featured.id === item.id));

  function resetFilters() {
    setSearch("");
    setSelectedType("ALL");
    setSelectedTag(null);
  }

  if (catalogQuery.isLoading) {
    return (
      <div className="space-y-4 md:space-y-6">
        <section className="app-glass relative overflow-hidden p-3 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(217,249,157,0.42),transparent_40%),radial-gradient(circle_at_90%_15%,rgba(42,52,44,0.12),transparent_50%)]" />
          <div className="relative">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink md:text-4xl">Learn</h1>
            <p className="mt-1 text-xs text-brand-muted md:mt-2 md:text-sm">Загружаем каталог обучающих материалов...</p>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`learn-skeleton-${index}`}
              className="h-80 animate-pulse rounded-3xl border border-brand-border bg-white/70"
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    );
  }

  if (catalogQuery.isError) {
    return (
      <div className="space-y-4 md:space-y-6">
        <section className="app-glass relative overflow-hidden p-3 md:p-6">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_10%,rgba(255,220,220,0.42),transparent_40%),radial-gradient(circle_at_90%_15%,rgba(42,52,44,0.08),transparent_50%)]" />
          <div className="relative space-y-3">
            <h1 className="text-2xl font-semibold tracking-tight text-brand-ink md:text-4xl">Learn</h1>
            <p className="text-xs text-brand-muted md:text-sm">Не удалось загрузить каталог материалов.</p>
            <Button type="button" onClick={() => void catalogQuery.refetch()}>
              Повторить
            </Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-6 md:space-y-6 md:pb-8">
      <section className="app-glass relative overflow-hidden p-3 md:p-6">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_5%,rgba(217,249,157,0.48),transparent_40%),radial-gradient(circle_at_82%_12%,rgba(171,206,255,0.22),transparent_40%),radial-gradient(circle_at_70%_85%,rgba(42,52,44,0.12),transparent_45%)]" />
          <div className="absolute -left-8 top-6 h-36 w-36 rounded-full bg-white/45 blur-2xl" />
          <div className="absolute right-4 top-4 h-28 w-28 rounded-full bg-[#d9f99d]/35 blur-2xl" />
        </div>

        <div className="relative space-y-3 md:space-y-4">
          <div className="grid gap-3 md:gap-4">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-2 rounded-lg border border-brand-border bg-white/85 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-muted md:mb-3 md:rounded-xl md:px-2.5 md:py-1 md:text-xs">
                <span className="grid h-4 w-4 place-items-center rounded-md border border-brand-border bg-white shadow-sm md:h-5 md:w-5">
                  <BookOpen className="h-3 w-3 text-brand-ink" />
                </span>
                Learn
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-brand-ink md:text-4xl">
                Обучающие материалы для артиста
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-relaxed text-brand-muted md:mt-2 md:text-sm">
                Каталог видео и статей по сонграйтингу, продакшну, записи, сведению и релизному менеджменту. Сохранён внутри
                приложения для будущего мобильного опыта.
              </p>
            </div>
          </div>

          <LearnFilters
            variant="embedded"
            search={search}
            onSearchChange={setSearch}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
            availableTags={catalogQuery.data?.availableTags ?? []}
            resultCount={filteredItems.length}
            onReset={resetFilters}
          />
        </div>
      </section>

      {!hasActiveFilters && featuredItems.length > 0 ? <LearnFeaturedStrip items={featuredItems} /> : null}

      <section className="space-y-3 md:space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-brand-ink md:text-2xl">
              {hasActiveFilters ? "Результаты" : "Все материалы"}
            </h2>
            <p className="mt-1 text-xs text-brand-muted md:text-sm">
              {hasActiveFilters
                ? "Отфильтрованный список по запросу, типу и тегам."
                : "Остальной каталог материалов после рекомендованной подборки."}
            </p>
          </div>
        </div>

        {gridItems.length ? (
          <div className="grid gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3">
            {gridItems.map((material) => (
              <LearnMaterialCard key={material.id} material={material} />
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-brand-border bg-white/80 p-6 text-center shadow-sm">
            <h3 className="text-lg font-semibold tracking-tight text-brand-ink">Ничего не найдено</h3>
            <p className="mt-2 text-sm text-brand-muted">
              Попробуйте убрать часть тегов или изменить поисковый запрос.
            </p>
            <Button type="button" variant="secondary" className="mt-4" onClick={resetFilters}>
              Сбросить фильтры
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
