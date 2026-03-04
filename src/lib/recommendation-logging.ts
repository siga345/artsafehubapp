import {
  LearnContextSurface,
  LearnApplicationTargetType,
  Prisma,
  PrismaClient,
  RecommendationEventType,
  RecommendationKind,
  RecommendationSource,
  RecommendationSurface,
  TrackDecisionType
} from "@prisma/client";

type DbClient = PrismaClient | Prisma.TransactionClient;

export type CreateRecommendationEventInput = {
  userId: string;
  recommendationKey: string;
  surface: RecommendationSurface;
  kind: RecommendationKind;
  eventType: RecommendationEventType;
  source: RecommendationSource;
  entityType?: string | null;
  entityId?: string | null;
  trackId?: string | null;
  goalId?: string | null;
  materialKey?: string | null;
  payload?: Prisma.InputJsonValue | null;
};

export async function createRecommendationEvent(db: DbClient, input: CreateRecommendationEventInput) {
  return db.recommendationEvent.create({
    data: {
      userId: input.userId,
      recommendationKey: input.recommendationKey,
      surface: input.surface,
      kind: input.kind,
      eventType: input.eventType,
      source: input.source,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      trackId: input.trackId ?? null,
      goalId: input.goalId ?? null,
      materialKey: input.materialKey ?? null,
      payload: input.payload ?? undefined
    }
  });
}

export type CreateTrackDecisionInput = {
  userId: string;
  trackId: string;
  type: TrackDecisionType;
  source: RecommendationSource;
  summary: string;
  reason?: string | null;
  demoId?: string | null;
  nextStepId?: string | null;
  feedbackItemId?: string | null;
  recommendationKey?: string | null;
  contextSnapshot?: Prisma.InputJsonValue | null;
  createdAt?: Date;
};

export async function createTrackDecision(db: DbClient, input: CreateTrackDecisionInput) {
  return db.trackDecision.create({
    data: {
      userId: input.userId,
      trackId: input.trackId,
      demoId: input.demoId ?? null,
      nextStepId: input.nextStepId ?? null,
      feedbackItemId: input.feedbackItemId ?? null,
      type: input.type,
      source: input.source,
      summary: input.summary,
      reason: input.reason ?? null,
      recommendationKey: input.recommendationKey ?? null,
      contextSnapshot: input.contextSnapshot ?? undefined,
      createdAt: input.createdAt ?? new Date()
    }
  });
}

export type CreateLearnApplicationInput = {
  userId: string;
  materialKey: string;
  surface: LearnContextSurface;
  targetType: LearnApplicationTargetType;
  source: RecommendationSource;
  targetTrackId?: string | null;
  targetGoalId?: string | null;
  reason?: string | null;
  recommendationKey?: string | null;
  contextSnapshot?: Prisma.InputJsonValue | null;
};

export async function createLearnApplication(db: DbClient, input: CreateLearnApplicationInput) {
  return db.learnApplication.create({
    data: {
      userId: input.userId,
      materialKey: input.materialKey,
      surface: input.surface,
      targetType: input.targetType,
      targetTrackId: input.targetTrackId ?? null,
      targetGoalId: input.targetGoalId ?? null,
      source: input.source,
      reason: input.reason ?? null,
      recommendationKey: input.recommendationKey ?? null,
      contextSnapshot: input.contextSnapshot ?? undefined
    }
  });
}
