import { NextResponse } from "next/server";
import { DemoVersionType } from "@prisma/client";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { canonicalizeSongStage } from "@/lib/song-stages";
import { isReleaseSongStage } from "@/lib/songs-version-stage-map";

const createTrackSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  pathStageId: z.number().int().optional().nullable(),
  lyricsText: z.string().max(10000).optional().nullable()
});

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function isMissingDemoReleaseDateSelectError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("model `demo`") &&
    message.includes("releasedate") &&
    message.includes("unknown field") &&
    message.includes("select")
  );
}

function serializeTrackWithReleaseMeta(rawTrack: any) {
  const { demos, distributionRequest, ...track } = rawTrack;
  const canonicalPathStage = track.pathStage ? canonicalizeSongStage(track.pathStage) : null;
  const releaseDemo = Array.isArray(demos) && demos.length > 0 ? demos[0] : null;
  const serializedDistributionRequest = distributionRequest
    ? {
        id: distributionRequest.id,
        artistName: distributionRequest.artistName,
        releaseTitle: distributionRequest.releaseTitle,
        releaseDate: formatDateOnly(distributionRequest.releaseDate),
        status: distributionRequest.status
      }
    : null;
  const serializedReleaseDemo = releaseDemo
    ? {
        id: releaseDemo.id,
        createdAt: releaseDemo.createdAt instanceof Date ? releaseDemo.createdAt.toISOString() : releaseDemo.createdAt,
        releaseDate: releaseDemo.releaseDate ? formatDateOnly(releaseDemo.releaseDate) : null
      }
    : null;

  const isLegacyRelease = canonicalPathStage?.name ? isReleaseSongStage(canonicalPathStage.name) : false;
  let releaseArchiveMeta: Record<string, unknown> | null = null;
  if (serializedDistributionRequest || serializedReleaseDemo || isLegacyRelease) {
    const source = serializedDistributionRequest
      ? "distribution_request"
      : serializedReleaseDemo
        ? "release_demo"
        : "legacy_stage";
    releaseArchiveMeta = {
      source,
      title: serializedDistributionRequest?.releaseTitle ?? track.title,
      artistName: serializedDistributionRequest?.artistName ?? track.project?.artistLabel ?? null,
      releaseDate: serializedDistributionRequest?.releaseDate ?? serializedReleaseDemo?.releaseDate ?? null,
      releaseKind: track.project?.releaseKind ?? null,
      coverType: track.project?.coverType ?? null,
      coverImageUrl: track.project?.coverImageUrl ?? null,
      coverPresetKey: track.project?.coverPresetKey ?? null,
      coverColorA: track.project?.coverColorA ?? null,
      coverColorB: track.project?.coverColorB ?? null,
      isArchivedSingle: track.project?.releaseKind === "SINGLE"
    };
  }

  return {
    ...track,
    pathStage: canonicalPathStage,
    distributionRequest: serializedDistributionRequest,
    releaseDemo: serializedReleaseDemo,
    releaseArchiveMeta
  };
}

export const GET = withApiHandler(async () => {
  const user = await requireUser();
  let tracks: any[] = [];
  try {
    tracks = await prisma.track.findMany({
      where: { userId: user.id },
      include: {
        folder: true,
        project: true,
        pathStage: true,
        distributionRequest: {
          select: {
            id: true,
            artistName: true,
            releaseTitle: true,
            releaseDate: true,
            status: true
          }
        },
        demos: {
          where: { versionType: DemoVersionType.RELEASE },
          orderBy: [{ sortIndex: "asc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            createdAt: true,
            releaseDate: true
          }
        },
        _count: { select: { demos: true } }
      } as any,
      orderBy: { updatedAt: "desc" }
    } as any);
  } catch (error) {
    if (!isMissingDemoReleaseDateSelectError(error)) {
      throw error;
    }
    tracks = await prisma.track.findMany({
      where: { userId: user.id },
      include: {
        folder: true,
        project: true,
        pathStage: true,
        distributionRequest: {
          select: {
            id: true,
            artistName: true,
            releaseTitle: true,
            releaseDate: true,
            status: true
          }
        },
        demos: {
          where: { versionType: DemoVersionType.RELEASE },
          orderBy: [{ sortIndex: "asc" }, { createdAt: "desc" }],
          take: 1,
          select: {
            id: true,
            createdAt: true
          }
        },
        _count: { select: { demos: true } }
      } as any,
      orderBy: { updatedAt: "desc" }
    } as any);
  }

  return NextResponse.json(tracks.map(serializeTrackWithReleaseMeta));
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
        data: shouldSyncSingleProjectTitle ? { title: trimmedTitle, updatedAt: new Date() } : { updatedAt: new Date() }
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
