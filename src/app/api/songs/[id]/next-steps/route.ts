import { NextStepOrigin, NextStepStatus, RecommendationEventType, RecommendationSource, TrackDecisionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recommendationContextSchema } from "@/contracts/recommendations";
import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createRecommendationEvent, createTrackDecision } from "@/lib/recommendation-logging";
import { requireUser } from "@/lib/server-auth";
import { createTrackNextStep, getActiveTrackNextStep, normalizeNextStepPayload } from "@/lib/track-next-steps";
import { serializeActiveNextStep } from "@/lib/track-workbench";

const createNextStepSchema = z.object({
  text: z.string().trim().min(1).max(240),
  reason: z.string().trim().max(1000).optional().nullable(),
  replaceCurrent: z.boolean().optional(),
  recommendationContext: recommendationContextSchema.optional()
});

export const POST = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createNextStepSchema);
  const payload = normalizeNextStepPayload(body);

  const nextStep = await prisma.$transaction(async (tx) => {
    const track = await tx.track.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true, projectId: true }
    });
    if (!track) {
      throw apiError(404, "Трек не найден.");
    }

    const activeStep = await getActiveTrackNextStep(tx, track.id);
    if (activeStep && body.replaceCurrent !== false) {
      await tx.trackNextStep.update({
        where: { id: activeStep.id },
        data: {
          status: NextStepStatus.CANCELED,
          canceledAt: new Date(),
          completedAt: null
        }
      });
      await createTrackDecision(tx, {
        userId: user.id,
        trackId: track.id,
        nextStepId: activeStep.id,
        type: TrackDecisionType.NEXT_STEP_CANCELED,
        source: RecommendationSource.MANUAL,
        summary: activeStep.text,
        reason: activeStep.reason
      });
    }
    if (activeStep && body.replaceCurrent === false) {
      throw apiError(409, "У трека уже есть активный следующий шаг.");
    }

    const created = await createTrackNextStep(tx, {
      userId: user.id,
      trackId: track.id,
      text: payload.text,
      reason: payload.reason,
      recommendationSource: RecommendationSource.MANUAL,
      origin: NextStepOrigin.SONG_DETAIL
    });

    await createTrackDecision(tx, {
      userId: user.id,
      trackId: track.id,
      nextStepId: created.id,
      type: TrackDecisionType.NEXT_STEP_SET,
      source: RecommendationSource.MANUAL,
      summary: created.text,
      reason: created.reason
    });

    await tx.track.update({
      where: { id: track.id },
      data: { updatedAt: new Date() }
    });

    if (track.projectId) {
      await tx.project.update({
        where: { id: track.projectId },
        data: { updatedAt: new Date() }
      });
    }

    if (body.recommendationContext) {
      await createRecommendationEvent(tx, {
        userId: user.id,
        recommendationKey: body.recommendationContext.recommendationKey,
        surface: body.recommendationContext.surface,
        kind: body.recommendationContext.kind,
        eventType: RecommendationEventType.APPLIED,
        source: body.recommendationContext.source,
        entityType: "track_next_step",
        entityId: created.id,
        trackId: track.id
      });
    }

    return created;
  });

  return NextResponse.json({ nextStep: serializeActiveNextStep(nextStep) }, { status: 201 });
});
