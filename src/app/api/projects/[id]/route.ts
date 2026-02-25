import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { canonicalizeSongStage } from "@/lib/song-stages";

const projectCoverTypeSchema = z.enum(["GRADIENT", "IMAGE"]);
const projectReleaseKindSchema = z.enum(["SINGLE", "ALBUM"]);

const updateProjectSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  folderId: z.string().optional().nullable(),
  pinned: z.boolean().optional(),
  artistLabel: z.string().max(120).optional().nullable(),
  releaseKind: projectReleaseKindSchema.optional(),
  coverType: projectCoverTypeSchema.optional(),
  coverImageUrl: z.string().max(2000).optional().nullable(),
  coverPresetKey: z.string().max(80).optional().nullable(),
  coverColorA: z.string().max(32).optional().nullable(),
  coverColorB: z.string().max(32).optional().nullable()
});

export const GET = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      folder: true,
      tracks: {
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
        include: {
          pathStage: true,
          primaryDemo: true,
          _count: { select: { demos: true } },
          demos: { orderBy: { createdAt: "desc" }, take: 1 }
        }
      },
      _count: { select: { tracks: true } }
    }
  });

  if (!project) {
    throw apiError(404, "Project not found");
  }

  return NextResponse.json({
    ...project,
    singleTrackId: project.releaseKind === "SINGLE" && project.tracks.length === 1 ? project.tracks[0]?.id ?? null : null,
    tracks: project.tracks.map((track) => ({
      ...track,
      pathStage: track.pathStage ? canonicalizeSongStage(track.pathStage) : null
    }))
  });
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateProjectSchema);

  const existing = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: { _count: { select: { tracks: true } } }
  });

  if (!existing) {
    throw apiError(404, "Project not found");
  }

  if (body.releaseKind === "SINGLE" && (existing._count?.tracks ?? 0) > 1) {
    throw apiError(400, "Single project can contain only one track.");
  }

  let nextSortIndex: number | undefined = undefined;
  if (body.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: body.folderId, userId: user.id }
    });
    if (!folder) {
      throw apiError(403, "Cannot use this folder");
    }
  }
  if (body.folderId !== undefined) {
    const targetFolderId = body.folderId ?? null;
    if (existing.folderId !== targetFolderId) {
      const lastSibling = await prisma.project.findFirst({
        where: { userId: user.id, folderId: targetFolderId },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      });
      nextSortIndex = (lastSibling?.sortIndex ?? -1) + 1;
    }
  }

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      title: body.title === undefined ? undefined : body.title.trim(),
      folderId: body.folderId === undefined ? undefined : body.folderId,
      pinnedAt: body.pinned === undefined ? undefined : body.pinned ? new Date() : null,
      artistLabel: body.artistLabel === undefined ? undefined : body.artistLabel?.trim() || null,
      releaseKind: body.releaseKind,
      coverType: body.coverType,
      coverImageUrl: body.coverImageUrl === undefined ? undefined : body.coverImageUrl?.trim() || null,
      coverPresetKey: body.coverPresetKey === undefined ? undefined : body.coverPresetKey?.trim() || null,
      coverColorA: body.coverColorA === undefined ? undefined : body.coverColorA?.trim() || null,
      coverColorB: body.coverColorB === undefined ? undefined : body.coverColorB?.trim() || null,
      sortIndex: nextSortIndex
    },
    include: {
      folder: true,
      _count: { select: { tracks: true } }
    }
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const forceDelete = new URL(request.url).searchParams.get("force") === "1";

  const project = await prisma.project.findFirst({
    where: { id: params.id, userId: user.id },
    include: { _count: { select: { tracks: true } } }
  });

  if (!project) {
    throw apiError(404, "Project not found");
  }

  if (project._count.tracks > 0 && !forceDelete) {
    throw apiError(400, "Project is not empty");
  }

  if (forceDelete && project._count.tracks > 0) {
    await prisma.$transaction([
      prisma.track.deleteMany({
        where: {
          userId: user.id,
          projectId: params.id
        }
      }),
      prisma.project.delete({ where: { id: params.id } })
    ]);
  } else {
    await prisma.project.delete({ where: { id: params.id } });
  }

  return NextResponse.json({ ok: true });
});
