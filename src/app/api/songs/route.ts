import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { canonicalizeSongStage } from "@/lib/song-stages";

const createTrackSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable(),
  lyricsText: z.string().max(10000).optional().nullable()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const tracks = await prisma.track.findMany({
    where: { userId: user.id },
    include: {
      folder: true,
      project: true,
      pathStage: true,
      _count: { select: { demos: true } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(
    tracks.map((track) => ({
      ...track,
      pathStage: track.pathStage ? canonicalizeSongStage(track.pathStage) : null
    }))
  );
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createTrackSchema);
  const trimmedTitle = body.title.trim();
  let resolvedFolderId = body.folderId ?? null;

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

  let resolvedProjectId = body.projectId ?? null;

  if (resolvedProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: resolvedProjectId, userId: user.id }
    });
    if (!project) {
      throw apiError(403, "Cannot use this project");
    }
    if (body.folderId !== undefined && project.folderId !== (body.folderId ?? null)) {
      throw apiError(400, "projectId and folderId mismatch");
    }
    if (body.folderId === undefined) {
      resolvedFolderId = project.folderId;
    }
  }

  const track = await prisma.$transaction(async (tx) => {
    if (!resolvedProjectId) {
      const createdProject = await tx.project.create({
        data: {
          userId: user.id,
          folderId: resolvedFolderId,
          title: trimmedTitle,
          coverType: "GRADIENT",
          coverPresetKey: "lime-grove",
          coverColorA: "#D9F99D",
          coverColorB: "#65A30D"
        }
      });
      resolvedProjectId = createdProject.id;
    }

    const createdTrack = await tx.track.create({
      data: {
        userId: user.id,
        title: trimmedTitle,
        lyricsText: body.lyricsText?.trim() || null,
        folderId: resolvedFolderId,
        projectId: resolvedProjectId,
        pathStageId: body.pathStageId ?? null
      },
      include: {
        folder: true,
        project: true,
        pathStage: true,
        _count: { select: { demos: true } }
      }
    });

    if (resolvedProjectId) {
      await tx.project.update({
        where: { id: resolvedProjectId },
        data: { updatedAt: new Date() }
      });
    }

    return createdTrack;
  });

  return NextResponse.json(
    {
      ...track,
      pathStage: track.pathStage ? canonicalizeSongStage(track.pathStage) : null
    },
    { status: 201 }
  );
});
