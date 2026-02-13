import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const createTrackSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const tracks = await prisma.track.findMany({
    where: { userId: user.id },
    include: {
      folder: true,
      pathStage: true,
      _count: { select: { demos: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(tracks);
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createTrackSchema);

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

  const track = await prisma.track.create({
    data: {
      userId: user.id,
      title: body.title.trim(),
      folderId: body.folderId ?? null,
      pathStageId: body.pathStageId ?? null
    },
    include: {
      folder: true,
      pathStage: true,
      _count: { select: { demos: true } }
    }
  });

  return NextResponse.json(track, { status: 201 });
});
