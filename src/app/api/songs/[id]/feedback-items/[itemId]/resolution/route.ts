import { FeedbackResolutionStatus, Prisma, RecommendationSource, TrackDecisionType } from "@prisma/client";
import { NextResponse } from "next/server";

import { updateFeedbackResolutionInputSchema } from "@/contracts/feedback";
import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import {
  buildTrackFeedbackSummary,
  deriveFeedbackRequestLifecycle,
  feedbackRequestSummarySelect,
  serializeFeedbackResolution
} from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
import { createTrackDecision } from "@/lib/recommendation-logging";
import { requireUser } from "@/lib/server-auth";

async function touchTrackActivity(tx: Prisma.TransactionClient, trackId: string, projectId: string | null) {
  await tx.track.update({
    where: { id: trackId },
    data: { updatedAt: new Date() }
  });

  if (projectId) {
    await tx.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() }
    });
  }
}

export const PATCH = withApiHandler(
  async (request: Request, { params }: { params: { id: string; itemId: string } }) => {
    const user = await requireUser();
    const body = await parseJsonBody(request, updateFeedbackResolutionInputSchema);

    const feedbackItem = await prisma.feedbackItem.findFirst({
      where: {
        id: params.itemId,
        request: {
          trackId: params.id,
          userId: user.id
        }
      },
      select: {
        id: true,
        requestId: true,
        request: {
          select: {
            id: true,
            trackId: true,
            receivedAt: true,
            reviewedAt: true,
            track: {
              select: {
                projectId: true
              }
            }
          }
        }
      }
    });

    if (!feedbackItem) {
      throw apiError(404, "Тезис фидбека не найден.");
    }

    let targetDemoId: string | null = null;
    if (body.status === FeedbackResolutionStatus.NEXT_VERSION && body.targetDemoId) {
      const targetDemo = await prisma.demo.findFirst({
        where: {
          id: body.targetDemoId,
          trackId: feedbackItem.request.trackId
        },
        select: { id: true }
      });

      if (!targetDemo) {
        throw apiError(400, "Выбранная версия не принадлежит этому треку.");
      }

      targetDemoId = targetDemo.id;
    }

    const payload = await prisma.$transaction(async (tx) => {
      const now = new Date();

      const resolution = await tx.feedbackResolution.upsert({
        where: { feedbackItemId: feedbackItem.id },
        update: {
          status: body.status,
          note: body.note?.trim() || null,
          targetDemoId: body.status === FeedbackResolutionStatus.NEXT_VERSION ? targetDemoId : null,
          resolvedAt: now
        },
        create: {
          userId: user.id,
          feedbackItemId: feedbackItem.id,
          status: body.status,
          note: body.note?.trim() || null,
          targetDemoId: body.status === FeedbackResolutionStatus.NEXT_VERSION ? targetDemoId : null,
          resolvedAt: now
        },
        include: {
          targetDemo: {
            select: {
              id: true,
              versionType: true,
              createdAt: true,
              releaseDate: true
            }
          }
        }
      });

      const requestWithItems = await tx.feedbackRequest.findUniqueOrThrow({
        where: { id: feedbackItem.requestId },
        select: {
          id: true,
          receivedAt: true,
          reviewedAt: true,
          items: {
            select: {
              id: true,
              resolution: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });

      const lifecycle = deriveFeedbackRequestLifecycle(
        {
          receivedAt: feedbackItem.request.receivedAt,
          reviewedAt: feedbackItem.request.reviewedAt
        },
        requestWithItems.items
      );

      const updatedRequest = await tx.feedbackRequest.update({
        where: { id: feedbackItem.requestId },
        data: lifecycle,
        select: {
          status: true
        }
      });

      await createTrackDecision(tx, {
        userId: user.id,
        trackId: feedbackItem.request.trackId,
        demoId: resolution.targetDemo?.id ?? null,
        feedbackItemId: feedbackItem.id,
        type: TrackDecisionType.FEEDBACK_OUTCOME_RECORDED,
        source: RecommendationSource.MANUAL,
        summary: resolution.status,
        reason: resolution.note
      });

      await touchTrackActivity(tx, feedbackItem.request.trackId, feedbackItem.request.track.projectId ?? null);

      const trackRequests = await tx.feedbackRequest.findMany({
        where: {
          trackId: feedbackItem.request.trackId,
          userId: user.id
        },
        orderBy: [{ updatedAt: "desc" }],
        select: feedbackRequestSummarySelect
      });

      return {
        resolution,
        requestStatus: updatedRequest.status,
        trackFeedbackSummary: buildTrackFeedbackSummary(trackRequests)
      };
    });

    return NextResponse.json({
      resolution: serializeFeedbackResolution(payload.resolution),
      requestStatus: payload.requestStatus,
      trackFeedbackSummary: payload.trackFeedbackSummary
    });
  }
);
