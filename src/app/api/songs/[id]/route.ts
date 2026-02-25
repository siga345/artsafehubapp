import { NextResponse } from "next/server";
import { DemoVersionType } from "@prisma/client";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { canonicalizeSongStage } from "@/lib/song-stages";

const updateTrackSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional(),
  primaryDemoId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable(),
  lyricsText: z.string().max(10000).optional().nullable()
});

export const GET = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const track = await prisma.track.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      folder: true,
      project: true,
      primaryDemo: true,
      pathStage: true,
      demos: { orderBy: { createdAt: "desc" } }
    }
  });

  if (!track) {
    throw apiError(404, "Track not found");
  }

  return NextResponse.json({
    ...track,
      pathStage: track.pathStage ? canonicalizeSongStage(track.pathStage) : null
  });
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateTrackSchema);
  const track = await prisma.track.findFirst({ where: { id: params.id, userId: user.id } });
  let resolvedFolderId = body.folderId;

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

  if (body.projectId) {
    const project = await prisma.project.findFirst({
      where: { id: body.projectId, userId: user.id },
      include: { _count: { select: { tracks: true } } }
    });
    if (!project) {
      throw apiError(403, "Cannot use this project");
    }
    if (project.releaseKind === "SINGLE") {
      const otherTracksCount = await prisma.track.count({
        where: { projectId: project.id, id: { not: track.id } }
      });
      if (otherTracksCount >= 1) {
        throw apiError(400, "Single project can contain only one track.");
      }
    }
    if (body.folderId !== undefined && project.folderId !== (body.folderId ?? null)) {
      throw apiError(400, "projectId and folderId mismatch");
    }
    if (body.folderId === undefined) {
      resolvedFolderId = project.folderId;
    }
  }

  if (body.primaryDemoId !== undefined && body.primaryDemoId !== null) {
    const demo = await prisma.demo.findFirst({
      where: { id: body.primaryDemoId, track: { userId: user.id } }
    });
    if (!demo) {
      throw apiError(404, "Demo not found");
    }
    if (demo.trackId !== track.id) {
      throw apiError(400, "primaryDemo must belong to track");
    }
    if (demo.versionType === DemoVersionType.IDEA_TEXT) {
      throw apiError(400, "IDEA_TEXT cannot be primary");
    }
  }

  const updatedTrack = await prisma.$transaction(async (tx) => {
    const nextTrack = await tx.track.update({
      where: { id: params.id },
      data: {
        title: body.title?.trim(),
        folderId: resolvedFolderId === undefined ? undefined : resolvedFolderId,
        projectId: body.projectId === undefined ? undefined : body.projectId,
        primaryDemoId: body.primaryDemoId === undefined ? undefined : body.primaryDemoId,
        pathStageId: body.pathStageId === undefined ? undefined : body.pathStageId,
        lyricsText: body.lyricsText === undefined ? undefined : body.lyricsText?.trim() || null
      },
      include: {
        folder: true,
        project: true,
        primaryDemo: true,
        pathStage: true,
        demos: { orderBy: { createdAt: "desc" } }
      }
    });

    const projectIdsToTouch = new Set<string>();
    if (track.projectId) projectIdsToTouch.add(track.projectId);
    if (nextTrack.projectId) projectIdsToTouch.add(nextTrack.projectId);

    if (projectIdsToTouch.size > 0) {
      await tx.project.updateMany({
        where: { id: { in: Array.from(projectIdsToTouch) } },
        data: { updatedAt: new Date() }
      });
    }

    if (resolvedFolderId !== undefined && nextTrack.projectId && body.projectId === undefined) {
      await tx.project.update({
        where: { id: nextTrack.projectId },
        data: { folderId: resolvedFolderId }
      });
    }

    if (nextTrack.projectId && nextTrack.project?.releaseKind === "SINGLE") {
      await tx.project.update({
        where: { id: nextTrack.projectId },
        data: { title: nextTrack.title }
      });
    }

    return nextTrack;
  });

  return NextResponse.json({
    ...updatedTrack,
    pathStage: updatedTrack.pathStage ? canonicalizeSongStage(updatedTrack.pathStage) : null
  });
});

export const DELETE = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const track = await prisma.track.findFirst({ where: { id: params.id, userId: user.id } });

  if (!track) {
    throw apiError(404, "Track not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.track.delete({ where: { id: params.id } });
    if (track.projectId) {
      await tx.project.update({
        where: { id: track.projectId },
        data: { updatedAt: new Date() }
      });
    }
  });
  return NextResponse.json({ ok: true });
});
