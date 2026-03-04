import {
  NextStepOrigin,
  NextStepStatus,
  Prisma,
  PrismaClient,
  RecommendationSource,
  TrackWorkbenchState
} from "@prisma/client";

import { apiError } from "@/lib/api";

type DbClient = PrismaClient | Prisma.TransactionClient;

type CreateTrackNextStepInput = {
  userId: string;
  trackId: string;
  text: string;
  reason?: string | null;
  recommendationSource?: RecommendationSource;
  origin?: NextStepOrigin;
};

export function normalizeNextStepPayload(input: { text: string; reason?: string | null }) {
  const text = input.text.trim();
  const reason = input.reason?.trim() || null;
  if (!text) {
    throw apiError(400, "Укажи следующий шаг.");
  }

  return {
    text,
    reason
  };
}

export async function getActiveTrackNextStep(db: DbClient, trackId: string) {
  return db.trackNextStep.findFirst({
    where: {
      trackId,
      status: NextStepStatus.ACTIVE
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }]
  });
}

export async function createTrackNextStep(db: DbClient, input: CreateTrackNextStepInput) {
  const payload = normalizeNextStepPayload(input);
  return db.trackNextStep.create({
    data: {
      userId: input.userId,
      trackId: input.trackId,
      text: payload.text,
      reason: payload.reason,
      recommendationSource: input.recommendationSource ?? RecommendationSource.MANUAL,
      origin: input.origin ?? NextStepOrigin.SONG_DETAIL,
      status: NextStepStatus.ACTIVE
    }
  });
}

export async function closeTrackNextStep(
  db: DbClient,
  nextStepId: string,
  status: "DONE" | "CANCELED"
) {
  return db.trackNextStep.update({
    where: { id: nextStepId },
    data: {
      status,
      completedAt: status === NextStepStatus.DONE ? new Date() : null,
      canceledAt: status === NextStepStatus.CANCELED ? new Date() : null
    }
  });
}

export function resolveWrapUpNextStepStatus(endState: TrackWorkbenchState) {
  if (endState === TrackWorkbenchState.IN_PROGRESS || endState === TrackWorkbenchState.READY_FOR_NEXT_STEP) {
    return NextStepStatus.DONE;
  }

  return NextStepStatus.CANCELED;
}

export async function assertOwnedTrack(db: DbClient, userId: string, trackId: string) {
  const track = await db.track.findFirst({
    where: {
      id: trackId,
      userId
    }
  });
  if (!track) {
    throw apiError(404, "Трек не найден.");
  }
  return track;
}
