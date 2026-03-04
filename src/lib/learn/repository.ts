import { PrismaClient } from "@prisma/client";

import { filterLearnMaterials } from "@/lib/learn/filtering";
import { LEARN_MOCK_MATERIALS, type LearnMaterialRecord } from "@/lib/learn/mock-materials";
import {
  emptyLearnProgressState,
  getLearnProgressMap,
  serializeLearnProgress,
  type LearnProgressRecord
} from "@/lib/learn/progress";
import type {
  LearnCatalogQuery,
  LearnCatalogResponse,
  LearnMaterialDetail,
  LearnMaterialListItem,
  LearnRecommendedActions
} from "@/lib/learn/types";

type DbClient = PrismaClient;

const defaultRecommendedActions: LearnRecommendedActions = {
  canApplyToTrack: true,
  canApplyToGoal: true,
  canSaveForLater: true,
  canMarkNotRelevant: true
};

function sortMaterials<T extends { sortOrder: number; title: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title, "ru");
  });
}

export function getLearnMaterialRecordBySlug(slug: string): LearnMaterialRecord | null {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;
  return LEARN_MOCK_MATERIALS.find((item) => item.slug === normalizedSlug) ?? null;
}

export function getLearnMaterialRecordById(materialId: string) {
  return LEARN_MOCK_MATERIALS.find((item) => item.id === materialId) ?? null;
}

function toPublicMaterial(
  item: LearnMaterialRecord,
  progressMap: Map<string, LearnProgressRecord>
): LearnMaterialListItem {
  const progressRecord = progressMap.get(item.id);
  return {
    id: item.id,
    slug: item.slug,
    type: item.type,
    title: item.title,
    authorName: item.authorName,
    sourceName: item.sourceName,
    summary: item.summary,
    thumbnailUrl: item.thumbnailUrl,
    tags: item.tags,
    sourceUrl: item.sourceUrl,
    language: item.language,
    durationMinutes: item.durationMinutes,
    readingMinutes: item.readingMinutes,
    provider: item.provider,
    embedUrl: item.embedUrl,
    isFeatured: item.isFeatured,
    sortOrder: item.sortOrder,
    progress: progressRecord ? serializeLearnProgress(progressRecord) : emptyLearnProgressState()
  };
}

export function materialRecordToPublicItem(
  item: LearnMaterialRecord,
  progress: LearnMaterialListItem["progress"] = emptyLearnProgressState()
): LearnMaterialListItem {
  return {
    id: item.id,
    slug: item.slug,
    type: item.type,
    title: item.title,
    authorName: item.authorName,
    sourceName: item.sourceName,
    summary: item.summary,
    thumbnailUrl: item.thumbnailUrl,
    tags: item.tags,
    sourceUrl: item.sourceUrl,
    language: item.language,
    durationMinutes: item.durationMinutes,
    readingMinutes: item.readingMinutes,
    provider: item.provider,
    embedUrl: item.embedUrl,
    isFeatured: item.isFeatured,
    sortOrder: item.sortOrder,
    progress
  };
}

export async function getLearnCatalog(db: DbClient, userId: string, query: LearnCatalogQuery = {}): Promise<LearnCatalogResponse> {
  const progressMap = await getLearnProgressMap(db, userId);
  const allItems = sortMaterials(LEARN_MOCK_MATERIALS.map((item) => toPublicMaterial(item, progressMap)));
  const filteredItems = sortMaterials(filterLearnMaterials(allItems, query));

  const availableTags = [...new Set(allItems.flatMap((item) => item.tags))].sort((a, b) =>
    a.localeCompare(b, "ru", { sensitivity: "base" })
  );
  const availableTypes = [...new Set(allItems.map((item) => item.type))].sort() as LearnCatalogResponse["availableTypes"];

  return {
    items: filteredItems,
    availableTags,
    availableTypes,
    total: filteredItems.length
  };
}

export async function getLearnMaterialBySlug(db: DbClient, userId: string, slug: string): Promise<LearnMaterialDetail | null> {
  const material = getLearnMaterialRecordBySlug(slug);
  if (!material) return null;

  const progressMap = await getLearnProgressMap(db, userId);
  const progress = progressMap.get(material.id);

  return {
    ...materialRecordToPublicItem(material, progress ? serializeLearnProgress(progress) : emptyLearnProgressState()),
    recommendedActions: defaultRecommendedActions
  };
}
