import type { RecommendationCard } from "@/contracts/recommendations";

export type LearnMaterialType = "VIDEO" | "ARTICLE" | "BOOK" | "PODCAST";
export type LearnMvpMaterialType = Extract<LearnMaterialType, "VIDEO" | "ARTICLE">;
export type LearnProvider = "YOUTUBE" | "VIMEO" | "WEB";

export type LearnProgressStatus = "OPEN" | "APPLIED" | "NOT_RELEVANT" | "LATER";
export type LearnContextSurface = "LEARN" | "TODAY" | "GOALS" | "SONGS";
export type LearnApplicationTargetType = "TRACK" | "GOAL";
export type LearnSurface = Extract<LearnContextSurface, "TODAY" | "GOALS">;
export type LearnProblemType = "DIRECTION" | "MOMENTUM" | "FEEDBACK" | "RELEASE_PLANNING";
export type LearnMatchReason = "PATH_STAGE" | "GOAL_TYPE" | "TRACK_STATE" | "PROBLEM_TYPE";

export type LearnAppliedTarget = {
  type: LearnApplicationTargetType;
  id: string;
  title: string;
} | null;

export interface LearnMaterialProgressState {
  status: LearnProgressStatus | null;
  updatedAt: string | null;
  appliedTarget: LearnAppliedTarget;
}

export interface LearnMaterialListItem {
  id: string;
  slug: string;
  type: LearnMvpMaterialType;
  title: string;
  authorName: string;
  sourceName: string;
  summary: string;
  thumbnailUrl: string;
  tags: string[];
  sourceUrl: string;
  language: string;
  durationMinutes?: number;
  readingMinutes?: number;
  provider: LearnProvider;
  embedUrl?: string;
  isFeatured: boolean;
  sortOrder: number;
  progress: LearnMaterialProgressState;
}

export type LearnMaterialDetail = LearnMaterialListItem;

export interface LearnCatalogQuery {
  q?: string;
  type?: LearnMvpMaterialType;
  tag?: string;
  featured?: boolean;
}

export interface LearnCatalogResponse {
  items: LearnMaterialListItem[];
  availableTags: string[];
  availableTypes: LearnMvpMaterialType[];
  total: number;
}

export interface LearnContextPrimaryAction {
  kind: "APPLY_TO_TRACK" | "APPLY_TO_GOAL" | "SAVE_FOR_LATER";
  targetId: string | null;
  targetLabel: string | null;
}

export interface LearnContextItem {
  material: LearnMaterialListItem;
  matchReasons: LearnMatchReason[];
  primaryAction: LearnContextPrimaryAction;
  recommendation: RecommendationCard;
}

export interface LearnContextBlock {
  surface: LearnSurface;
  title: string;
  subtitle: string;
  empty: boolean;
  items: LearnContextItem[];
}

export type LearnProgressMutationResponse = {
  progress: LearnMaterialProgressState;
};
