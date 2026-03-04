import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { getIdentityProfile } from "@/lib/artist-growth";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { serializeTrackListItem, trackListInclude } from "@/lib/track-workbench";
import { createTrackCreatedAchievement } from "@/lib/community/achievements";

const createTrackSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable(),
  lyricsText: z.string().max(10000).optional().nullable()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  const [tracks, identityProfile, primaryGoal] = await Promise.all([
    prisma.track.findMany({
      where: { userId: user.id },
      include: trackListInclude,
      orderBy: { updatedAt: "desc" }
    }),
    getIdentityProfile(prisma, user.id),
    prisma.artistGoal.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
        isPrimary: true
      },
      select: { id: true }
    })
  ]);

  return NextResponse.json(
    tracks.map((track) =>
      serializeTrackListItem(track, {
        identityProfile,
        primaryGoalId: primaryGoal?.id ?? null
      })
    )
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
  let shouldSyncSingleProjectTitle = false;

  if (resolvedProjectId) {
    const project = await prisma.project.findFirst({
      where: { id: resolvedProjectId, userId: user.id },
      include: { _count: { select: { tracks: true } } }
    });
    if (!project) {
      throw apiError(403, "Cannot use this project");
    }
    if (project.releaseKind === "SINGLE" && (project._count?.tracks ?? 0) >= 1) {
      throw apiError(400, "Single project can contain only one track.");
    }
    if (project.releaseKind === "SINGLE") {
      shouldSyncSingleProjectTitle = true;
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
          releaseKind: "SINGLE",
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
        include: trackListInclude
      });

    if (resolvedProjectId) {
      await tx.project.update({
        where: { id: resolvedProjectId },
        data: shouldSyncSingleProjectTitle ? { title: trimmedTitle, updatedAt: new Date() } : { updatedAt: new Date() }
      });
    }

    await createTrackCreatedAchievement(tx, {
      userId: user.id,
      trackId: createdTrack.id,
      trackTitle: createdTrack.title
    });

    return createdTrack;
  });

  const [identityProfile, primaryGoal] = await Promise.all([
    getIdentityProfile(prisma, user.id),
    prisma.artistGoal.findFirst({
      where: {
        userId: user.id,
        status: "ACTIVE",
        isPrimary: true
      },
      select: { id: true }
    })
  ]);

  return NextResponse.json(
    serializeTrackListItem(track as any, {
      identityProfile,
      primaryGoalId: primaryGoal?.id ?? null
    }),
    { status: 201 }
  );
});
