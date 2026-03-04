import {
  type InAppRequest,
  type InAppRequestAction,
  InAppRequestActionType,
  InAppRequestStatus,
  type Prisma,
  type User
} from "@prisma/client";

import type { RequestCardDto } from "@/lib/in-app-requests";

export const requestInclude = {
  artist: {
    select: {
      id: true,
      safeId: true,
      nickname: true
    }
  },
  specialist: {
    select: {
      id: true,
      safeId: true,
      nickname: true
    }
  },
  track: {
    select: {
      id: true,
      title: true
    }
  },
  demo: {
    select: {
      id: true,
      versionType: true
    }
  },
  actions: {
    include: {
      actor: {
        select: {
          id: true,
          safeId: true,
          nickname: true
        }
      }
    },
    orderBy: {
      createdAt: "desc" as const
    }
  }
} satisfies Prisma.InAppRequestInclude;

export type InAppRequestWithRelations = Prisma.InAppRequestGetPayload<{ include: typeof requestInclude }>;

export type RequestActionInput = "MARK_VIEWED" | "ACCEPT" | "DECLINE" | "CANCEL" | "ARCHIVE";

export function resolveAvailableActions(request: InAppRequest, userId: string): RequestActionInput[] {
  const isArtist = request.artistUserId === userId;
  const isSpecialist = request.specialistUserId === userId;

  if (!isArtist && !isSpecialist) return [];

  const actions: RequestActionInput[] = [];

  if (isSpecialist && request.status === InAppRequestStatus.SUBMITTED) {
    actions.push("MARK_VIEWED", "ACCEPT", "DECLINE");
  }

  if (isSpecialist && request.status === InAppRequestStatus.VIEWED) {
    actions.push("ACCEPT", "DECLINE");
  }

  if (
    isArtist &&
    (request.status === InAppRequestStatus.SUBMITTED ||
      request.status === InAppRequestStatus.VIEWED ||
      request.status === InAppRequestStatus.ACCEPTED)
  ) {
    actions.push("CANCEL");
  }

  if (
    request.status === InAppRequestStatus.ACCEPTED ||
    request.status === InAppRequestStatus.DECLINED ||
    request.status === InAppRequestStatus.CANCELLED ||
    request.status === InAppRequestStatus.EXPIRED
  ) {
    actions.push("ARCHIVE");
  }

  return actions;
}

export function resolveNextStatus(currentStatus: InAppRequestStatus, action: RequestActionInput) {
  switch (action) {
    case "MARK_VIEWED":
      if (currentStatus !== InAppRequestStatus.SUBMITTED) return null;
      return InAppRequestStatus.VIEWED;
    case "ACCEPT":
      if (currentStatus !== InAppRequestStatus.SUBMITTED && currentStatus !== InAppRequestStatus.VIEWED) return null;
      return InAppRequestStatus.ACCEPTED;
    case "DECLINE":
      if (currentStatus !== InAppRequestStatus.SUBMITTED && currentStatus !== InAppRequestStatus.VIEWED) return null;
      return InAppRequestStatus.DECLINED;
    case "CANCEL":
      if (
        currentStatus !== InAppRequestStatus.SUBMITTED &&
        currentStatus !== InAppRequestStatus.VIEWED &&
        currentStatus !== InAppRequestStatus.ACCEPTED
      ) {
        return null;
      }
      return InAppRequestStatus.CANCELLED;
    case "ARCHIVE":
      if (
        currentStatus !== InAppRequestStatus.ACCEPTED &&
        currentStatus !== InAppRequestStatus.DECLINED &&
        currentStatus !== InAppRequestStatus.CANCELLED &&
        currentStatus !== InAppRequestStatus.EXPIRED
      ) {
        return null;
      }
      return InAppRequestStatus.ARCHIVED;
    default:
      return null;
  }
}

export function mapActionType(action: RequestActionInput): InAppRequestActionType {
  switch (action) {
    case "MARK_VIEWED":
      return InAppRequestActionType.MARK_VIEWED;
    case "ACCEPT":
      return InAppRequestActionType.ACCEPT;
    case "DECLINE":
      return InAppRequestActionType.DECLINE;
    case "CANCEL":
      return InAppRequestActionType.CANCEL;
    case "ARCHIVE":
      return InAppRequestActionType.ARCHIVE;
    default:
      return InAppRequestActionType.MARK_VIEWED;
  }
}

export function serializeRequest(request: InAppRequestWithRelations, userId: string): RequestCardDto {
  return {
    id: request.id,
    type: request.type,
    status: request.status,
    brief: request.brief,
    serviceLabel: request.serviceLabel,
    city: request.city,
    isRemote: request.isRemote,
    preferredStartAt: request.preferredStartAt ? request.preferredStartAt.toISOString() : null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    trackId: request.track?.id ?? null,
    demoId: request.demo?.id ?? null,
    trackTitle: request.track?.title ?? null,
    demoVersionType: request.demo?.versionType ?? null,
    artist: {
      userId: request.artist.id,
      safeId: request.artist.safeId,
      nickname: request.artist.nickname
    },
    specialist: {
      userId: request.specialist.id,
      safeId: request.specialist.safeId,
      nickname: request.specialist.nickname
    },
    history: request.actions.map((item) => ({
      id: item.id,
      action: item.action,
      comment: item.comment,
      createdAt: item.createdAt.toISOString(),
      actor: {
        userId: item.actor.id,
        safeId: item.actor.safeId,
        nickname: item.actor.nickname
      }
    })),
    availableActions: resolveAvailableActions(request, userId)
  };
}

export function canUserOperateAction(request: InAppRequest, user: Pick<User, "id">, action: RequestActionInput) {
  const isArtist = request.artistUserId === user.id;
  const isSpecialist = request.specialistUserId === user.id;

  if (!isArtist && !isSpecialist) {
    return false;
  }

  if (action === "MARK_VIEWED" || action === "ACCEPT" || action === "DECLINE") {
    return isSpecialist;
  }

  if (action === "CANCEL") {
    return isArtist;
  }

  if (action === "ARCHIVE") {
    return isArtist || isSpecialist;
  }

  return false;
}
