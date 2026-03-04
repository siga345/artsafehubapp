import type {
  LearnMaterialDetail,
  LearnMaterialListItem,
  LearnMatchReason,
  LearnMvpMaterialType,
  LearnProgressStatus,
  LearnProvider
} from "@/lib/learn/types";

export const learnProviderLabels: Record<LearnProvider, string> = {
  YOUTUBE: "YouTube",
  VIMEO: "Vimeo",
  WEB: "Web"
};

export const learnMaterialTypeLabels: Record<LearnMvpMaterialType, string> = {
  VIDEO: "Видео",
  ARTICLE: "Статья"
};

export const learnProgressStatusLabels: Record<LearnProgressStatus, string> = {
  OPEN: "Открыто",
  APPLIED: "Применено",
  NOT_RELEVANT: "Не подошло",
  LATER: "Вернуться позже"
};

export const learnMatchReasonLabels: Record<LearnMatchReason, string> = {
  PATH_STAGE: "PATH stage",
  GOAL_TYPE: "goal type",
  TRACK_STATE: "track state",
  PROBLEM_TYPE: "problem type"
};

export function getLearnProviderLabel(provider: LearnProvider) {
  return learnProviderLabels[provider] ?? provider;
}

export function getLearnMaterialTypeLabel(type: LearnMvpMaterialType) {
  return learnMaterialTypeLabels[type] ?? type;
}

export function getLearnProgressStatusLabel(status: LearnProgressStatus) {
  return learnProgressStatusLabels[status] ?? status;
}

export function getLearnMatchReasonLabel(reason: LearnMatchReason) {
  return learnMatchReasonLabels[reason] ?? reason;
}

export function supportsInlineEmbed(material: Pick<LearnMaterialListItem, "embedUrl">) {
  return Boolean(material.embedUrl?.trim());
}

export function getLearnMaterialTimeLabel(material: Pick<LearnMaterialDetail, "type" | "durationMinutes" | "readingMinutes">) {
  if (material.type === "VIDEO" && typeof material.durationMinutes === "number") {
    return `${material.durationMinutes} мин`;
  }
  if (material.type === "ARTICLE" && typeof material.readingMinutes === "number") {
    return `${material.readingMinutes} мин чтения`;
  }
  return null;
}
