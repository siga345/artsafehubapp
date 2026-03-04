import {
  LearnApplicationTargetType,
  LearnContextSurface,
  LearnProgressStatus,
  Prisma,
  PrismaClient
} from "@prisma/client";

import type { RecommendationContext } from "@/contracts/recommendations";
import { apiError } from "@/lib/api";
import { createLearnApplication, createRecommendationEvent } from "@/lib/recommendation-logging";
import type {
  LearnAppliedTarget,
  LearnMaterialProgressState,
  LearnProgressMutationResponse
} from "@/lib/learn/types";

type DbClient = PrismaClient | Prisma.TransactionClient;

const learnProgressInclude = {
  lastAppliedTrack: {
    select: {
      id: true,
      title: true
    }
  },
  lastAppliedGoal: {
    select: {
      id: true,
      title: true
    }
  }
} satisfies Prisma.LearnMaterialProgressInclude;

export type LearnProgressRecord = Prisma.LearnMaterialProgressGetPayload<{ include: typeof learnProgressInclude }>;

export type LearnProgressMutationInput =
  | {
      action: "OPEN";
      surface: LearnContextSurface;
      recommendationContext?: RecommendationContext;
    }
  | {
      action: "APPLY";
      surface: LearnContextSurface;
      targetType: LearnApplicationTargetType;
      targetId: string;
      recommendationContext?: RecommendationContext;
    }
  | {
      action: "LATER" | "NOT_RELEVANT";
      surface: LearnContextSurface;
      recommendationContext?: RecommendationContext;
    };

export function emptyLearnProgressState(): LearnMaterialProgressState {
  return {
    status: null,
    updatedAt: null,
    appliedTarget: null
  };
}

function serializeAppliedTarget(record: LearnProgressRecord): LearnAppliedTarget {
  if (record.lastAppliedTargetType === LearnApplicationTargetType.TRACK && record.lastAppliedTrack) {
    return {
      type: "TRACK",
      id: record.lastAppliedTrack.id,
      title: record.lastAppliedTrack.title
    };
  }

  if (record.lastAppliedTargetType === LearnApplicationTargetType.GOAL && record.lastAppliedGoal) {
    return {
      type: "GOAL",
      id: record.lastAppliedGoal.id,
      title: record.lastAppliedGoal.title
    };
  }

  return null;
}

export function serializeLearnProgress(record: LearnProgressRecord | null | undefined): LearnMaterialProgressState {
  if (!record) {
    return emptyLearnProgressState();
  }

  return {
    status: record.status,
    updatedAt: record.updatedAt.toISOString(),
    appliedTarget: serializeAppliedTarget(record)
  };
}

export async function getLearnProgressMap(db: DbClient, userId: string) {
  const rows = await db.learnMaterialProgress.findMany({
    where: { userId },
    include: learnProgressInclude
  });

  return new Map(rows.map((row) => [row.materialKey, row]));
}

async function getOwnedApplyTargetTitle(db: DbClient, userId: string, targetType: LearnApplicationTargetType, targetId: string) {
  if (targetType === LearnApplicationTargetType.TRACK) {
    const track = await db.track.findFirst({
      where: {
        id: targetId,
        userId
      },
      select: {
        id: true,
        title: true
      }
    });

    if (!track) {
      throw apiError(404, "Трек для применения материала не найден.");
    }

    return {
      type: LearnApplicationTargetType.TRACK,
      id: track.id,
      title: track.title
    };
  }

  const goal = await db.artistGoal.findFirst({
    where: {
      id: targetId,
      userId
    },
    select: {
      id: true,
      title: true
    }
  });

  if (!goal) {
    throw apiError(404, "Цель для применения материала не найдена.");
  }

  return {
    type: LearnApplicationTargetType.GOAL,
    id: goal.id,
    title: goal.title
  };
}

export async function applyLearnProgressMutation(
  db: DbClient,
  userId: string,
  materialKey: string,
  input: LearnProgressMutationInput
): Promise<LearnProgressMutationResponse> {
  const existing = await db.learnMaterialProgress.findUnique({
    where: {
      userId_materialKey: {
        userId,
        materialKey
      }
    }
  });

  const now = new Date();
  let createData: Prisma.LearnMaterialProgressUncheckedCreateInput;
  let updateData: Prisma.LearnMaterialProgressUncheckedUpdateInput;

  if (input.action === "OPEN") {
    const nextStatus =
      existing?.status === LearnProgressStatus.APPLIED ||
      existing?.status === LearnProgressStatus.LATER ||
      existing?.status === LearnProgressStatus.NOT_RELEVANT
        ? existing.status
        : LearnProgressStatus.OPEN;

    createData = {
      userId,
      materialKey,
      status: nextStatus,
      firstOpenedAt: now,
      lastOpenedAt: now,
      lastSurface: input.surface
    };
    updateData = {
      status: nextStatus,
      firstOpenedAt: existing?.firstOpenedAt ?? now,
      lastOpenedAt: now,
      lastSurface: input.surface
    };
  } else if (input.action === "APPLY") {
    const target = await getOwnedApplyTargetTitle(db, userId, input.targetType, input.targetId);
    createData = {
      userId,
      materialKey,
      status: LearnProgressStatus.APPLIED,
      firstOpenedAt: now,
      lastOpenedAt: now,
      appliedAt: now,
      lastSurface: input.surface,
      lastAppliedTargetType: input.targetType,
      lastAppliedTrackId: target.type === LearnApplicationTargetType.TRACK ? target.id : null,
      lastAppliedGoalId: target.type === LearnApplicationTargetType.GOAL ? target.id : null
    };
    updateData = {
      status: LearnProgressStatus.APPLIED,
      firstOpenedAt: existing?.firstOpenedAt ?? now,
      lastOpenedAt: now,
      appliedAt: now,
      lastSurface: input.surface,
      lastAppliedTargetType: input.targetType,
      lastAppliedTrackId: target.type === LearnApplicationTargetType.TRACK ? target.id : null,
      lastAppliedGoalId: target.type === LearnApplicationTargetType.GOAL ? target.id : null
    };

    await createLearnApplication(db, {
      userId,
      materialKey,
      surface: input.surface,
      targetType: input.targetType,
      targetTrackId: target.type === LearnApplicationTargetType.TRACK ? target.id : null,
      targetGoalId: target.type === LearnApplicationTargetType.GOAL ? target.id : null,
      source: input.recommendationContext?.source ?? "SYSTEM",
      reason: input.recommendationContext?.payload && typeof input.recommendationContext.payload.reason === "string"
        ? input.recommendationContext.payload.reason
        : null,
      recommendationKey: input.recommendationContext?.recommendationKey ?? null,
      contextSnapshot: input.recommendationContext
        ? {
            surface: input.recommendationContext.surface,
            kind: input.recommendationContext.kind
          }
        : {
            surface: input.surface
          }
    });
  } else if (input.action === "LATER") {
    createData = {
      userId,
      materialKey,
      status: LearnProgressStatus.LATER,
      firstOpenedAt: now,
      lastOpenedAt: now,
      laterAt: now,
      lastSurface: input.surface
    };
    updateData = {
      status: LearnProgressStatus.LATER,
      firstOpenedAt: existing?.firstOpenedAt ?? now,
      lastOpenedAt: now,
      laterAt: now,
      lastSurface: input.surface
    };
  } else {
    createData = {
      userId,
      materialKey,
      status: LearnProgressStatus.NOT_RELEVANT,
      firstOpenedAt: now,
      lastOpenedAt: now,
      notRelevantAt: now,
      lastSurface: input.surface
    };
    updateData = {
      status: LearnProgressStatus.NOT_RELEVANT,
      firstOpenedAt: existing?.firstOpenedAt ?? now,
      lastOpenedAt: now,
      notRelevantAt: now,
      lastSurface: input.surface
    };
  }

  const saved = await db.learnMaterialProgress.upsert({
    where: {
      userId_materialKey: {
        userId,
        materialKey
      }
    },
    update: updateData,
    create: createData,
    include: learnProgressInclude
  });

  if (input.recommendationContext && input.action !== "OPEN") {
    await createRecommendationEvent(db, {
      userId,
      recommendationKey: input.recommendationContext.recommendationKey,
      surface: input.recommendationContext.surface,
      kind: input.recommendationContext.kind,
      eventType: input.action === "APPLY" ? "APPLIED" : "DISMISSED",
      source: input.recommendationContext.source,
      entityType: "learn_material",
      entityId: materialKey,
      trackId: input.action === "APPLY" && input.targetType === LearnApplicationTargetType.TRACK ? input.targetId : null,
      goalId: input.action === "APPLY" && input.targetType === LearnApplicationTargetType.GOAL ? input.targetId : null,
      materialKey
    });
  }

  return {
    progress: serializeLearnProgress(saved)
  };
}
