import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const updateTrackSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable()
});

export const GET = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const track = await prisma.track.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      folder: true,
      pathStage: true,
      demos: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!track) {
    throw apiError(404, "Track not found");
  }

  return NextResponse.json(track);
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateTrackSchema);
  const track = await prisma.track.findFirst({ where: { id: params.id, userId: user.id } });

  if (!track) {
    throw apiError(404, "Track not found");
  }

  if (body.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: body.folderId, userId: user.id }
    });
    if (!folder) {
      throw apiError(403, "Cannot use this folder");
    }
  }

  if (body.pathStageId) {
    const stage = await prisma.pathStage.findUnique({ where: { id: body.pathStageId } });
    if (!stage) {
      throw apiError(400, "Invalid pathStageId");
    }
  }

  const updatedTrack = await prisma.track.update({
    where: { id: params.id },
    data: {
      title: body.title?.trim(),
      folderId: body.folderId === undefined ? undefined : body.folderId,
      pathStageId: body.pathStageId === undefined ? undefined : body.pathStageId
    },
    include: {
      folder: true,
      pathStage: true,
      demos: { orderBy: { createdAt: "desc" } }
    }
  });

  return NextResponse.json(updatedTrack);
});

export const DELETE = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const track = await prisma.track.findFirst({ where: { id: params.id, userId: user.id } });

  if (!track) {
    throw apiError(404, "Track not found");
  }

  await prisma.track.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});
