import { InAppRequestActionType, InAppRequestStatus, InAppRequestType } from "@prisma/client";

export const requestStatusLabelRu: Record<InAppRequestStatus, string> = {
  DRAFT: "Черновик",
  SUBMITTED: "Отправлена",
  VIEWED: "Просмотрена",
  ACCEPTED: "Принята",
  DECLINED: "Отклонена",
  CANCELLED: "Отменена",
  EXPIRED: "Истекла",
  ARCHIVED: "В архиве"
};

export const requestTypeLabelRu: Record<InAppRequestType, string> = {
  PRODUCTION: "Продакшн",
  MIX_MASTER: "Сведение и мастеринг",
  STUDIO_SESSION: "Студийная сессия",
  PROMO_PRODUCTION: "Промо-продакшн"
};

export const requestActionLabelRu: Record<InAppRequestActionType, string> = {
  SUBMIT: "Заявка создана",
  MARK_VIEWED: "Заявка просмотрена",
  ACCEPT: "Заявка принята",
  DECLINE: "Заявка отклонена",
  CANCEL: "Заявка отменена",
  ARCHIVE: "Заявка отправлена в архив"
};

export type RequestsRoleFilter = "ARTIST" | "SPECIALIST";

export type RequestHistoryItemDto = {
  id: string;
  action: InAppRequestActionType;
  comment: string | null;
  createdAt: string;
  actor: {
    userId: string;
    safeId: string;
    nickname: string;
  };
};

export type RequestCardDto = {
  id: string;
  type: InAppRequestType;
  status: InAppRequestStatus;
  brief: string;
  serviceLabel: string | null;
  city: string | null;
  isRemote: boolean;
  preferredStartAt: string | null;
  createdAt: string;
  updatedAt: string;
  trackId: string | null;
  demoId: string | null;
  trackTitle: string | null;
  demoVersionType: string | null;
  artist: {
    userId: string;
    safeId: string;
    nickname: string;
  };
  specialist: {
    userId: string;
    safeId: string;
    nickname: string;
  };
  history: RequestHistoryItemDto[];
  availableActions: Array<"MARK_VIEWED" | "ACCEPT" | "DECLINE" | "CANCEL" | "ARCHIVE">;
};

export type OnboardingStepId = "profile" | "first_song" | "first_demo" | "first_request" | "daily_checkin";

export type OnboardingStepDto = {
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
  completed: boolean;
};

export type OnboardingChecklistState = {
  isVisible: boolean;
  dismissedAt: string | null;
  completedCount: number;
  totalCount: number;
  steps: OnboardingStepDto[];
  nextStep: OnboardingStepDto | null;
};
