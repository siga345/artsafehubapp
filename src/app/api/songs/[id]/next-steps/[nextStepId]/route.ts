import { NextStepStatus, RecommendationEventType, RecommendationSource, TrackDecisionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { recommendationContextSchema } from "@/contracts/recommendations";
import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createRecommendationEvent, createTrackDecision } from "@/lib/recommendation-logging";
import { requireUser } from "@/lib/server-auth";
import { serializeActiveNextStep } from "@/lib/track-workbench";

const updateNextStepSchema = z.object({
  text: z.string().trim().min(1).max(240).optional(),
  reason: z.string().trim().max(1000).optional().nullable(),
  status: z.nativeEnum(NextStepStatus).optional(),
  recommendationContext: recommendationContextSchema.optional()
});

export const PATCH = withApiHandler(
  async (request: Request, { params }: { params: { id: string; nextStepId: string } }) => {
    const user = await requireUser();
    const body = await parseJsonBody(request, updateNextStepSchema);

    const nextStep = await prisma.$transaction(async (tx) => {
      const track = await tx.track.findFirst({
        where: { id: params.id, userId: user.id },
        select: { id: true, projectId: true }
      });
      if (!track) {
        throw apiError(404, "Трек не найден.");
      }

      const target = await tx.trackNextStep.findFirst({
        where: {
          id: params.nextStepId,
          trackId: track.id,
          userId: user.id
        }
      });
      if (!target) {
        throw apiError(404, "Следующий шаг не найден.");
      }

      if (body.status === NextStepStatus.ACTIVE) {
        const currentActive = await tx.trackNextStep.findFirst({
          where: {
            trackId: track.id,
            userId: user.id,
            status: NextStepStatus.ACTIVE,
            id: { not: target.id }
          },
          select: { id: true }
        });
        if (currentActive) {
          throw apiError(409, "У трека уже есть другой активный следующий шаг.");
        }
      }

      const status = body.status ?? target.status;
      const updated = await tx.trackNextStep.update({
        where: { id: target.id },
        data: {
          text: body.text?.trim(),
          reason: body.reason === undefined ? undefined : body.reason?.trim() || null,
          status,
          completedAt:
            body.status === undefined ? undefined : status === NextStepStatus.DONE ? target.completedAt ?? new Date() : null,
          canceledAt:
            body.status === undefined
              ? undefined
              : status === NextStepStatus.CANCELED
                ? target.canceledAt ?? new Date()
                : null
        }
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

      if (body.status === NextStepStatus.DONE) {
        await createTrackDecision(tx, {
          userId: user.id,
          trackId: track.id,
          nextStepId: updated.id,
          type: TrackDecisionType.NEXT_STEP_COMPLETED,
          source: updated.recommendationSource,
          summary: updated.text,
          reason: updated.reason
        });
      } else if (body.status === NextStepStatus.CANCELED) {
        await createTrackDecision(tx, {
          userId: user.id,
          trackId: track.id,
          nextStepId: updated.id,
          type: TrackDecisionType.NEXT_STEP_CANCELED,
          source: updated.recommendationSource,
          summary: updated.text,
          reason: updated.reason
        });
      }

      if (body.recommendationContext && (body.status === NextStepStatus.DONE || body.status === NextStepStatus.CANCELED)) {
        await createRecommendationEvent(tx, {
          userId: user.id,
          recommendationKey: body.recommendationContext.recommendationKey,
          surface: body.recommendationContext.surface,
          kind: body.recommendationContext.kind,
          eventType: body.status === NextStepStatus.DONE ? RecommendationEventType.COMPLETED : RecommendationEventType.APPLIED,
          source: body.recommendationContext.source,
          entityType: "track_next_step",
          entityId: updated.id,
          trackId: track.id
        });
      }

      return updated;
    });

    return NextResponse.json({ nextStep: serializeActiveNextStep(nextStep) });
  }
);
