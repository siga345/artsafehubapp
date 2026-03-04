import { FeedbackItemCategory, FeedbackRecipientMode, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { createFeedbackResponseInputSchema } from "@/contracts/feedback";
import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import {
  deriveFeedbackRequestLifecycle,
  feedbackRequestInclude,
  normalizeFeedbackLines,
  serializeFeedbackRequest
} from "@/lib/feedback";
import { prisma } from "@/lib/prisma";
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

const feedbackSectionDefinitions = [
  { key: "whatWorks", category: FeedbackItemCategory.WHAT_WORKS },
  { key: "notReading", category: FeedbackItemCategory.NOT_READING },
  { key: "sags", category: FeedbackItemCategory.SAGS },
  { key: "wantToHearNext", category: FeedbackItemCategory.WANT_TO_HEAR_NEXT }
] as const;

export const POST = withApiHandler(
  async (request: Request, { params }: { params: { id: string; requestId: string } }) => {
    const user = await requireUser();
    const body = await parseJsonBody(request, createFeedbackResponseInputSchema);

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const existing = await tx.feedbackRequest.findFirst({
        where: {
          id: params.requestId,
          trackId: params.id,
          OR: [
            { userId: user.id },
            {
              recipientMode: FeedbackRecipientMode.INTERNAL_USER,
              recipientUserId: user.id
            }
          ]
        },
        select: {
          id: true,
          userId: true,
          trackId: true,
          recipientMode: true,
          recipientUserId: true,
          receivedAt: true,
          reviewedAt: true,
          track: {
            select: {
              projectId: true
            }
          },
          items: {
            select: {
              id: true,
              category: true,
              resolution: {
                select: {
                  id: true
                }
              }
            }
          }
        }
      });

      if (!existing) {
        throw apiError(404, "Запрос на фидбек не найден.");
      }

      const isInternalRecipientReply =
        existing.recipientMode === FeedbackRecipientMode.INTERNAL_USER &&
        existing.recipientUserId === user.id &&
        existing.userId !== user.id;

      const perCategoryCounts = new Map<FeedbackItemCategory, number>();
      for (const item of existing.items) {
        perCategoryCounts.set(item.category, (perCategoryCounts.get(item.category) ?? 0) + 1);
      }

      const itemsToCreate = feedbackSectionDefinitions.flatMap(({ key, category }) => {
        const normalized = normalizeFeedbackLines(body.sections[key]);
        const startIndex = perCategoryCounts.get(category) ?? 0;
        perCategoryCounts.set(category, startIndex + normalized.length);

        return normalized.map((line, index) => ({
          requestId: existing.id,
          authorUserId: isInternalRecipientReply ? user.id : null,
          source: isInternalRecipientReply ? "INTERNAL_USER_REPLY" : "OWNER_ENTRY",
          category,
          body: line,
          sortIndex: startIndex + index
        }));
      });

      if (itemsToCreate.length === 0) {
        throw apiError(400, "Добавь хотя бы один тезис в ответе.");
      }

      await tx.feedbackItem.createMany({
        data: itemsToCreate
      });

      const nextRequest = await tx.feedbackRequest.findUniqueOrThrow({
        where: { id: existing.id },
        include: feedbackRequestInclude
      });

      const lifecycle = deriveFeedbackRequestLifecycle(
        {
          receivedAt: existing.receivedAt,
          reviewedAt: existing.reviewedAt
        },
        nextRequest.items
      );

      await tx.feedbackRequest.update({
        where: { id: existing.id },
        data: lifecycle
      });

      await touchTrackActivity(tx, existing.trackId, existing.track.projectId ?? null);

      return tx.feedbackRequest.findUniqueOrThrow({
        where: { id: existing.id },
        include: feedbackRequestInclude
      });
    });

    return NextResponse.json(serializeFeedbackRequest(updatedRequest), { status: 201 });
  }
);
