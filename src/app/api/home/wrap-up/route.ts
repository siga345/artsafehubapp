import {
  NextStepOrigin,
  RecommendationSource,
  TrackDecisionType,
  TrackWorkbenchState
} from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { getDailyWrapUp, toDateOnly, touchTrackAndProject } from "@/lib/day-loop";
import { prisma } from "@/lib/prisma";
import { createTrackDecision } from "@/lib/recommendation-logging";
import { requireUser } from "@/lib/server-auth";
import {
  assertOwnedTrack,
  closeTrackNextStep,
  createTrackNextStep,
  getActiveTrackNextStep,
  normalizeNextStepPayload,
  resolveWrapUpNextStepStatus
} from "@/lib/track-next-steps";
import { serializeDailyWrapUp, serializeDayLoopTrack } from "@/lib/track-workbench";
import { dayLoopTrackInclude } from "@/lib/track-workbench";

const wrapUpSchema = z.object({
  trackId: z.string().min(1),
  focusId: z.string().optional().nullable(),
  endState: z.nativeEnum(TrackWorkbenchState),
  whatChanged: z.string().trim().min(1).max(2000),
  whatNotWorking: z.string().trim().max(2000).optional().nullable(),
  nextStep: z.object({
    text: z.string().trim().min(1).max(240),
    reason: z.string().trim().max(1000).optional().nullable()
  })
});

export const PUT = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, wrapUpSchema);
  const today = toDateOnly(new Date());
  const nextStepPayload = normalizeNextStepPayload(body.nextStep);

  const result = await prisma.$transaction(async (tx) => {
    const track = await assertOwnedTrack(tx, user.id, body.trackId);

    if (body.focusId) {
      const focus = await tx.dailyTrackFocus.findFirst({
        where: {
          id: body.focusId,
          userId: user.id,
          trackId: track.id
        },
        select: { id: true }
      });
      if (!focus) {
        throw apiError(400, "Фокус дня не найден для этого трека.");
      }
    }

    const activeStep = await getActiveTrackNextStep(tx, track.id);
    if (activeStep) {
      const closedStatus = resolveWrapUpNextStepStatus(body.endState);
      await closeTrackNextStep(tx, activeStep.id, closedStatus);
      await createTrackDecision(tx, {
        userId: user.id,
        trackId: track.id,
        nextStepId: activeStep.id,
        type: closedStatus === "DONE" ? TrackDecisionType.NEXT_STEP_COMPLETED : TrackDecisionType.NEXT_STEP_CANCELED,
        source: activeStep.recommendationSource,
        summary: activeStep.text,
        reason: activeStep.reason
      });
    }

    const createdNextStep = await createTrackNextStep(tx, {
      userId: user.id,
      trackId: track.id,
      text: nextStepPayload.text,
      reason: nextStepPayload.reason,
      recommendationSource: RecommendationSource.MANUAL,
      origin: NextStepOrigin.WRAP_UP
    });
    await createTrackDecision(tx, {
      userId: user.id,
      trackId: track.id,
      nextStepId: createdNextStep.id,
      type: TrackDecisionType.NEXT_STEP_SET,
      source: RecommendationSource.MANUAL,
      summary: createdNextStep.text,
      reason: createdNextStep.reason
    });

    await tx.track.update({
      where: { id: track.id },
      data: {
        workbenchState: body.endState
      }
    });

    const wrapUp = await tx.dailyWrapUp.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      },
      update: {
        trackId: track.id,
        focusId: body.focusId ?? null,
        nextStepId: createdNextStep.id,
        endState: body.endState,
        whatChanged: body.whatChanged.trim(),
        whatNotWorking: body.whatNotWorking?.trim() || null
      },
      create: {
        userId: user.id,
        date: today,
        trackId: track.id,
        focusId: body.focusId ?? null,
        nextStepId: createdNextStep.id,
        endState: body.endState,
        whatChanged: body.whatChanged.trim(),
        whatNotWorking: body.whatNotWorking?.trim() || null
      },
      include: {
        nextStep: true
      }
    });

    await createTrackDecision(tx, {
      userId: user.id,
      trackId: track.id,
      nextStepId: createdNextStep.id,
      type: TrackDecisionType.WRAP_UP_RECORDED,
      source: RecommendationSource.MANUAL,
      summary: body.whatChanged.trim(),
      reason: body.whatNotWorking?.trim() || null,
      contextSnapshot: {
        endState: body.endState,
        focusId: body.focusId ?? null
      }
    });

    await touchTrackAndProject(tx, track.id);

    const hydratedTrack = await tx.track.findUniqueOrThrow({
      where: { id: track.id },
      include: dayLoopTrackInclude
    });

    return {
      wrapUp,
      track: hydratedTrack
    };
  });

  return NextResponse.json({
    wrapUp: serializeDailyWrapUp(result.wrapUp),
    currentNextStep: result.wrapUp.nextStep
      ? {
          id: result.wrapUp.nextStep.id,
          text: result.wrapUp.nextStep.text,
          reason: result.wrapUp.nextStep.reason ?? null,
          status: result.wrapUp.nextStep.status,
          source: result.wrapUp.nextStep.recommendationSource,
          origin: result.wrapUp.nextStep.origin,
          createdAt: result.wrapUp.nextStep.createdAt.toISOString(),
          updatedAt: result.wrapUp.nextStep.updatedAt.toISOString()
        }
      : null,
    track: serializeDayLoopTrack(result.track)
  });
});
