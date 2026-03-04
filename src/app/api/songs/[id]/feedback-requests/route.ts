import { FeedbackRecipientMode, FeedbackRequestStatus, FeedbackRequestType, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { createFeedbackRequestInputSchema } from "@/contracts/feedback";
import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { createFeedbackRequestedAchievement } from "@/lib/community/achievements";
import { createCommunityFeedbackRequestPost } from "@/lib/community/service";
import { feedbackRequestInclude, serializeFeedbackRequest } from "@/lib/feedback";
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

export const GET = withApiHandler(async (_request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const requests = await prisma.feedbackRequest.findMany({
    where: {
      trackId: params.id,
      OR: [
        { userId: user.id },
        {
          recipientMode: FeedbackRecipientMode.INTERNAL_USER,
          recipientUserId: user.id
        }
      ]
    },
    include: feedbackRequestInclude,
    orderBy: [{ updatedAt: "desc" }]
  });

  if (requests.length === 0) {
    const track = await prisma.track.findFirst({
      where: { id: params.id, userId: user.id },
      select: { id: true }
    });

    if (!track) {
      throw apiError(404, "Трек не найден.");
    }
  }

  return NextResponse.json({
    items: requests.map((request) => serializeFeedbackRequest(request))
  });
});

export const POST = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createFeedbackRequestInputSchema);

  const track = await prisma.track.findFirst({
    where: { id: params.id, userId: user.id },
    select: {
      id: true,
      title: true,
      projectId: true,
      lyricsText: true
    }
  });

  if (!track) {
    throw apiError(404, "Трек не найден.");
  }

  let demoId: string | null = null;
  if (body.type === FeedbackRequestType.TEXT) {
    if (!track.lyricsText?.trim()) {
      throw apiError(400, "Для фидбека по тексту сначала добавь текст песни.");
    }
  } else {
    if (!body.demoId?.trim()) {
      throw apiError(400, "Для этого типа фидбека выбери версию.");
    }

    const demo = await prisma.demo.findFirst({
      where: {
        id: body.demoId.trim(),
        trackId: track.id
      },
      select: { id: true }
    });

    if (!demo) {
      throw apiError(400, "Выбранная версия не принадлежит этому треку.");
    }

    demoId = demo.id;
  }

  let recipientUserId: string | null = null;
  let recipientLabel = "";
  let communityTitle = body.communityTitle?.trim() || "";
  const communityHelpfulActionPrompt = body.communityHelpfulActionPrompt?.trim() || null;
  const supportNeedTypes = body.supportNeedTypes ?? [];

  if (body.recipientMode === FeedbackRecipientMode.COMMUNITY) {
    recipientLabel = "Community";
    if (!body.requestMessage?.trim()) {
      throw apiError(400, "Для community-запроса опиши, что именно нужно проверить.");
    }
    if (!communityTitle) {
      throw apiError(400, "Для community-запроса укажи заголовок карточки.");
    }
  } else if (body.recipientMode === FeedbackRecipientMode.INTERNAL_USER) {
    const safeId = body.recipientSafeId?.trim();
    if (!safeId) {
      throw apiError(400, "Укажи SAFE ID получателя.");
    }

    const recipientUser = await prisma.user.findUnique({
      where: { safeId },
      select: {
        id: true,
        nickname: true
      }
    });

    if (!recipientUser) {
      throw apiError(400, "Пользователь с таким SAFE ID не найден.");
    }

    recipientUserId = recipientUser.id;
    recipientLabel = recipientUser.nickname;
  } else {
    recipientLabel = body.recipientLabel?.trim() ?? "";
    if (!recipientLabel) {
      throw apiError(400, "Укажи имя получателя.");
    }
  }

  const requestMessage = body.requestMessage?.trim() || null;
  const recipientChannel = body.recipientChannel?.trim() || null;
  const recipientContact = body.recipientContact?.trim() || null;

  const created = await prisma.$transaction(async (tx) => {
    const nextRequest = await tx.feedbackRequest.create({
      data: {
        userId: user.id,
        trackId: track.id,
        demoId,
        type: body.type,
        status: FeedbackRequestStatus.PENDING,
        recipientMode: body.recipientMode,
        recipientUserId,
        recipientLabel,
        recipientChannel,
        recipientContact,
        requestMessage,
        lyricsSnapshot: body.type === FeedbackRequestType.TEXT ? track.lyricsText?.trim() ?? null : null
      },
      include: feedbackRequestInclude
    });

    if (body.recipientMode === FeedbackRecipientMode.COMMUNITY) {
      const post = await createCommunityFeedbackRequestPost(tx, user.id, {
        feedbackRequestId: nextRequest.id,
        title: communityTitle,
        text: requestMessage ?? "Нужен взгляд сообщества на этот трек.",
        trackId: track.id,
        demoId,
        supportNeedTypes,
        helpfulActionPrompt: communityHelpfulActionPrompt,
        focusSnapshot: body.type === FeedbackRequestType.TEXT ? track.lyricsText?.trim() ?? null : null
      });

      await tx.communityFeedbackThread.create({
        data: {
          feedbackRequestId: nextRequest.id,
          communityPostId: post.id,
          trackId: track.id,
          demoId,
          authorUserId: user.id
        }
      });

      await createFeedbackRequestedAchievement(tx, {
        userId: user.id,
        feedbackRequestId: nextRequest.id,
        trackId: track.id,
        trackTitle: track.title,
        communityTitle
      });
    }

    await touchTrackActivity(tx, track.id, track.projectId ?? null);

    return tx.feedbackRequest.findUniqueOrThrow({
      where: { id: nextRequest.id },
      include: feedbackRequestInclude
    });
  });

  return NextResponse.json(serializeFeedbackRequest(created), { status: 201 });
});
