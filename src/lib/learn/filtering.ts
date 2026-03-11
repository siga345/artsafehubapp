import type { LearnCatalogQuery, LearnMaterialListItem } from "@/lib/learn/types";

function normalizeValue(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

export function normalizeLearnToken(value: string) {
  return normalizeValue(value);
}

export function filterLearnMaterials(items: LearnMaterialListItem[], query: LearnCatalogQuery = {}) {
  const normalizedQuery = normalizeValue(query.q ?? "");
  const normalizedTag = normalizeValue(query.tag ?? "");

  return items.filter((item) => {
    if (query.type && item.type !== query.type) return false;
    if (typeof query.featured === "boolean" && item.isFeatured !== query.featured) return false;

    if (normalizedTag) {
      const hasTag = item.tags.some((tag) => normalizeValue(tag) === normalizedTag);
      if (!hasTag) return false;
    }

    if (!normalizedQuery) return true;

    const haystack = [
      item.title,
      item.summary,
      item.authorName,
      item.sourceName,
      item.tags.join(" ")
    ]
      .map(normalizeValue)
      .join(" ");

    return haystack.includes(normalizedQuery);
  });
}
