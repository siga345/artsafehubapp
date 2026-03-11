import { type LearnMaterial, PrismaClient } from "@prisma/client";

import { filterLearnMaterials } from "@/lib/learn/filtering";
import {
  emptyLearnProgressState,
  getLearnProgressMap,
  serializeLearnProgress,
  type LearnProgressRecord
} from "@/lib/learn/progress";
import type {
  LearnCatalogQuery,
  LearnCatalogResponse,
  LearnContextSurface,
  LearnMaterialDetail,
  LearnMaterialListItem,
  LearnMvpMaterialType,
  LearnProblemType,
  LearnProvider
} from "@/lib/learn/types";
import type { ArtistGoalType, TrackWorkbenchState } from "@prisma/client";

type DbClient = PrismaClient;

export type LearnMaterialRecord = Omit<LearnMaterialDetail, "progress"> & {
  workflow: {
    stageOrders: number[];
    goalTypes: ArtistGoalType[];
    trackStates: TrackWorkbenchState[];
    problemTypes: LearnProblemType[];
    preferredSurfaces: LearnContextSurface[];
  };
};

function sortMaterials<T extends { sortOrder: number; title: string }>(items: T[]) {
  return [...items].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.title.localeCompare(b.title, "ru");
  });
}

function toLearnMaterialRecord(m: LearnMaterial): LearnMaterialRecord {
  return {
    id: m.id,
    slug: m.slug,
    type: m.type as LearnMvpMaterialType,
    title: m.title,
    authorName: m.authorName,
    sourceName: m.sourceName,
    summary: m.summary,
    thumbnailUrl: m.thumbnailUrl,
    tags: m.tags,
    sourceUrl: m.sourceUrl,
    language: m.language,
    durationMinutes: m.durationMinutes ?? undefined,
    readingMinutes: m.readingMinutes ?? undefined,
    provider: m.provider as LearnProvider,
    embedUrl: m.embedUrl ?? undefined,
    isFeatured: m.isFeatured,
    sortOrder: m.sortOrder,
    workflow: {
      stageOrders: m.stageOrders,
      goalTypes: m.goalTypes as ArtistGoalType[],
      trackStates: m.trackStates as TrackWorkbenchState[],
      problemTypes: m.problemTypes as LearnProblemType[],
      preferredSurfaces: m.preferredSurfaces as LearnContextSurface[]
    }
  };
}

export async function getAllLearnMaterialRecords(db: DbClient): Promise<LearnMaterialRecord[]> {
  const rows = await db.learnMaterial.findMany({ orderBy: { sortOrder: "asc" } });
  return rows.map(toLearnMaterialRecord);
}

export async function getLearnMaterialRecordBySlug(db: DbClient, slug: string): Promise<LearnMaterialRecord | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;
  const row = await db.learnMaterial.findUnique({ where: { slug: normalizedSlug } });
  return row ? toLearnMaterialRecord(row) : null;
}

export async function getLearnMaterialRecordById(db: DbClient, materialId: string): Promise<LearnMaterialRecord | null> {
  const row = await db.learnMaterial.findUnique({ where: { id: materialId } });
  return row ? toLearnMaterialRecord(row) : null;
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
  const [materials, progressMap] = await Promise.all([
    getAllLearnMaterialRecords(db),
    getLearnProgressMap(db, userId)
  ]);

  const allItems = sortMaterials(materials.map((item) => toPublicMaterial(item, progressMap)));
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
  const material = await getLearnMaterialRecordBySlug(db, slug);
  if (!material) return null;

  const progressMap = await getLearnProgressMap(db, userId);
  const progress = progressMap.get(material.id);

  return {
    ...materialRecordToPublicItem(material, progress ? serializeLearnProgress(progress) : emptyLearnProgressState())
  };
}
