import { NextStepOrigin, NextStepStatus, RecommendationSource, TrackDecisionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { getDailyTrackFocus, toDateOnly, touchTrackAndProject } from "@/lib/day-loop";
import { prisma } from "@/lib/prisma";
import { createTrackDecision } from "@/lib/recommendation-logging";
import { requireUser } from "@/lib/server-auth";
import { createTrackNextStep, getActiveTrackNextStep, normalizeNextStepPayload } from "@/lib/track-next-steps";
import { serializeDailyTrackFocus } from "@/lib/track-workbench";

const trackFocusSchema = z.object({
  trackId: z.string().min(1),
  nextStepId: z.string().optional().nullable(),
  focusNote: z.string().trim().max(1000).optional().nullable(),
  createNextStep: z
    .object({
      text: z.string().trim().min(1).max(240),
      reason: z.string().trim().max(1000).optional().nullable()
    })
    .optional()
});

export const PUT = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, trackFocusSchema);
  const today = toDateOnly(new Date());

  const focus = await prisma.$transaction(async (tx) => {
    const track = await tx.track.findFirst({
      where: {
        id: body.trackId,
        userId: user.id
      },
      select: { id: true }
    });
    if (!track) {
      throw apiError(404, "Трек не найден.");
    }

    let nextStepId = body.nextStepId ?? null;
    const activeStep = await getActiveTrackNextStep(tx, track.id);

    if (body.createNextStep) {
      if (activeStep) {
        throw apiError(409, "У трека уже есть активный следующий шаг.");
      }
      const payload = normalizeNextStepPayload(body.createNextStep);
      const createdStep = await createTrackNextStep(tx, {
        userId: user.id,
        trackId: track.id,
        text: payload.text,
        reason: payload.reason,
        recommendationSource: RecommendationSource.MANUAL,
        origin: NextStepOrigin.MORNING_FOCUS
      });
      await createTrackDecision(tx, {
        userId: user.id,
        trackId: track.id,
        nextStepId: createdStep.id,
        type: TrackDecisionType.NEXT_STEP_SET,
        source: RecommendationSource.MANUAL,
        summary: createdStep.text,
        reason: createdStep.reason
      });
      nextStepId = createdStep.id;
    }

    if (!nextStepId && activeStep) {
      nextStepId = activeStep.id;
    }

    if (nextStepId) {
      const nextStep = await tx.trackNextStep.findFirst({
        where: {
          id: nextStepId,
          trackId: track.id,
          userId: user.id,
          status: NextStepStatus.ACTIVE
        }
      });
      if (!nextStep) {
        throw apiError(400, "Можно выбрать только активный следующий шаг этого трека.");
      }
    }

    const saved = await tx.dailyTrackFocus.upsert({
      where: {
        userId_date: {
          userId: user.id,
          date: today
        }
      },
      update: {
        trackId: track.id,
        nextStepId,
        focusNote: body.focusNote?.trim() || null
      },
      create: {
        userId: user.id,
        date: today,
        trackId: track.id,
        nextStepId,
        focusNote: body.focusNote?.trim() || null
      }
    });

    await touchTrackAndProject(tx, track.id);

    return tx.dailyTrackFocus.findUniqueOrThrow({
      where: { id: saved.id },
      include: {
        track: {
          include: {
            project: {
              select: {
                id: true,
                title: true,
                artistLabel: true,
                releaseKind: true,
                coverType: true,
                coverImageUrl: true,
                coverPresetKey: true,
                coverColorA: true,
                coverColorB: true
              }
            },
            pathStage: true,
            trackIntent: true,
            nextSteps: {
              where: { status: NextStepStatus.ACTIVE },
              orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
              take: 1
            }
          }
        },
        nextStep: true
      }
    });
  });

  return NextResponse.json(serializeDailyTrackFocus(focus));
});
