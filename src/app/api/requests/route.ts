import { NextResponse } from "next/server";
import { InAppRequestActionType, InAppRequestStatus, InAppRequestType } from "@prisma/client";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { requestInclude, serializeRequest } from "@/app/api/requests/request-utils";
import { createRequestSubmittedAchievement } from "@/lib/community/achievements";

const createRequestSchema = z.object({
  type: z.nativeEnum(InAppRequestType),
  specialistUserId: z.string().min(1),
  trackId: z.string().optional(),
  demoId: z.string().optional(),
  serviceLabel: z.string().trim().max(140).optional(),
  brief: z.string().trim().min(10).max(3000),
  preferredStartAt: z.string().datetime().optional(),
  city: z.string().trim().max(120).optional(),
  isRemote: z.boolean().default(true)
});

const roleSchema = z.enum(["ARTIST", "SPECIALIST"]);

export const GET = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const { searchParams } = new URL(request.url);

  const roleRaw = searchParams.get("role")?.toUpperCase();
  const role = roleSchema.safeParse(roleRaw);
  const roleFilter = role.success ? role.data : "ARTIST";

  const statusRaw = searchParams.get("status");
  const status = statusRaw ? z.nativeEnum(InAppRequestStatus).safeParse(statusRaw) : null;

  const where =
    roleFilter === "SPECIALIST"
      ? { specialistUserId: user.id, ...(status?.success ? { status: status.data } : {}) }
      : { artistUserId: user.id, ...(status?.success ? { status: status.data } : {}) };

  const requests = await prisma.inAppRequest.findMany({
    where,
    include: requestInclude,
    orderBy: [{ updatedAt: "desc" }]
  });

  return NextResponse.json({
    items: requests.map((item) => serializeRequest(item, user.id))
  });
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createRequestSchema);

  if (body.specialistUserId === user.id) {
    throw apiError(400, "Нельзя отправить заявку самому себе.");
  }

  const specialist = await prisma.user.findUnique({
    where: { id: body.specialistUserId },
    select: { id: true, nickname: true, specialistProfile: { select: { userId: true } } }
  });

  if (!specialist || !specialist.specialistProfile) {
    throw apiError(400, "Специалист не найден.");
  }

  let resolvedTrackId: string | null = null;
  let resolvedDemoId: string | null = null;

  if (body.trackId) {
    const track = await prisma.track.findFirst({
      where: { id: body.trackId, userId: user.id },
      select: { id: true }
    });
    if (!track) {
      throw apiError(400, "Трек для заявки не найден.");
    }
    resolvedTrackId = track.id;
  }

  if (body.demoId) {
    const demo = await prisma.demo.findFirst({
      where: {
        id: body.demoId,
        track: {
          userId: user.id,
          ...(resolvedTrackId ? { id: resolvedTrackId } : {})
        }
      },
      select: { id: true, trackId: true }
    });

    if (!demo) {
      throw apiError(400, "Версия для заявки не найдена.");
    }

    resolvedDemoId = demo.id;
    if (!resolvedTrackId) {
      resolvedTrackId = demo.trackId;
    }
  }

  const preferredStartAt = body.preferredStartAt ? new Date(body.preferredStartAt) : null;
  if (preferredStartAt && Number.isNaN(preferredStartAt.getTime())) {
    throw apiError(400, "Некорректная дата старта.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const requestRecord = await tx.inAppRequest.create({
      data: {
        type: body.type,
        status: InAppRequestStatus.SUBMITTED,
        artistUserId: user.id,
        specialistUserId: specialist.id,
        trackId: resolvedTrackId,
        demoId: resolvedDemoId,
        serviceLabel: body.serviceLabel?.trim() || null,
        brief: body.brief.trim(),
        preferredStartAt,
        city: body.city?.trim() || null,
        isRemote: body.isRemote
      }
    });

    await tx.inAppRequestAction.create({
      data: {
        requestId: requestRecord.id,
        actorUserId: user.id,
        action: InAppRequestActionType.SUBMIT,
        comment: null
      }
    });

    await createRequestSubmittedAchievement(tx, {
      userId: user.id,
      requestId: requestRecord.id,
      trackId: resolvedTrackId,
      specialistNickname: specialist.nickname
    });

    return tx.inAppRequest.findUniqueOrThrow({
      where: { id: requestRecord.id },
      include: requestInclude
    });
  });

  return NextResponse.json(serializeRequest(created, user.id), { status: 201 });
});
