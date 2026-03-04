"use client";

import type {
  ArtistSupportNeedType,
  CommunityFeedItemDto,
  CommunityHelpfulActionType,
  CommunityPostKind,
  CommunityRoleBadge,
  FriendshipStateDto
} from "@/contracts/community";

export const roleLabelByType: Record<CommunityRoleBadge, string> = {
  ARTIST: "Артист",
  SPECIALIST: "Специалист",
  STUDIO: "Студия",
  ADMIN: "Команда"
};

export const supportNeedLabelByType: Record<ArtistSupportNeedType, string> = {
  FEEDBACK: "Нужен фидбек",
  ACCOUNTABILITY: "Нужна поддержка",
  CREATIVE_DIRECTION: "Нужен direction",
  COLLABORATION: "Ищу коллаб"
};

export const helpfulActionLabelByType: Record<CommunityHelpfulActionType, string> = {
  I_CAN_HELP: "Я могу помочь",
  I_RELATED: "У меня было похоже",
  KEEP_GOING: "Продолжай"
};

export const postKindLabelByType: Record<CommunityPostKind, string> = {
  GENERAL: "Пост",
  PROGRESS: "Прогресс",
  FEEDBACK_REQUEST: "Запрос фидбека",
  CREATIVE_QUESTION: "Творческий вопрос"
};

export function formatCommunityDate(value: string) {
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long"
  });
}

export function formatCommunityDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getFriendshipPrimaryAction(state: FriendshipStateDto) {
  switch (state.state) {
    case "NONE":
      return { label: "Добавить в друзья", action: "send" as const };
    case "OUTGOING_PENDING":
      return { label: "Запрос отправлен", action: "cancel" as const };
    case "INCOMING_PENDING":
      return { label: "Принять", action: "accept" as const };
    case "FRIENDS":
      return { label: "В друзьях", action: "remove" as const };
  }
}

export function getFriendshipSecondaryAction(state: FriendshipStateDto) {
  if (state.state === "INCOMING_PENDING") {
    return { label: "Отклонить", action: "decline" as const };
  }
  return null;
}

export function renderFeedSubtitle(item: CommunityFeedItemDto) {
  if (item.content.type === "POST") {
    return postKindLabelByType[item.content.postKind];
  }
  if (item.content.type === "EVENT") return "Ивент сообщества";
  return item.content.title;
}

export function eventMeta(event: { startsAt: string; isOnline: boolean; city: string | null }) {
  return [formatCommunityDateTime(event.startsAt), event.isOnline ? "Онлайн" : event.city ?? "Оффлайн"]
    .filter(Boolean)
    .join(" · ");
}
