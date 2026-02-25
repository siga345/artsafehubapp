import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const projectCoverTypeSchema = z.enum(["GRADIENT", "IMAGE"]);
const projectReleaseKindSchema = z.enum(["SINGLE", "ALBUM"]);

const createProjectSchema = z.object({
  title: z.string().min(1).max(120),
  folderId: z.string().optional().nullable(),
  artistLabel: z.string().max(120).optional().nullable(),
  releaseKind: projectReleaseKindSchema.optional(),
  coverType: projectCoverTypeSchema.optional(),
  coverImageUrl: z.string().max(2000).optional().nullable(),
  coverPresetKey: z.string().max(80).optional().nullable(),
  coverColorA: z.string().max(32).optional().nullable(),
  coverColorB: z.string().max(32).optional().nullable()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const projects = await prisma.project.findMany({
    where: { userId: user.id },
    include: {
      folder: true,
      _count: { select: { tracks: true } },
      tracks: {
        select: { id: true },
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }],
        take: 2
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(
    projects.map(({ tracks, ...project }) => ({
      ...project,
      singleTrackId: project.releaseKind === "SINGLE" && tracks.length === 1 ? tracks[0]?.id ?? null : null
    }))
  );
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, createProjectSchema);

  const targetFolderId = body.folderId ?? null;
  if (body.folderId) {
    const folder = await prisma.folder.findFirst({
      where: { id: body.folderId, userId: user.id }
    });
    if (!folder) {
      throw apiError(403, "Cannot use this folder");
    }
  }

  const lastSibling = await prisma.project.findFirst({
    where: { userId: user.id, folderId: targetFolderId },
    select: { sortIndex: true },
    orderBy: { sortIndex: "desc" }
  });

  const project = await prisma.project.create({
    data: {
      userId: user.id,
      title: body.title.trim(),
      folderId: targetFolderId,
      artistLabel: body.artistLabel?.trim() || null,
      releaseKind: body.releaseKind ?? "ALBUM",
      coverType: body.coverType ?? "GRADIENT",
      coverImageUrl: body.coverImageUrl?.trim() || null,
      coverPresetKey: body.coverPresetKey?.trim() || (body.coverType === "IMAGE" ? null : "lime-grove"),
      coverColorA: body.coverColorA?.trim() || (body.coverType === "IMAGE" ? null : "#D9F99D"),
      coverColorB: body.coverColorB?.trim() || (body.coverType === "IMAGE" ? null : "#65A30D"),
      sortIndex: (lastSibling?.sortIndex ?? -1) + 1
    },
    include: {
      folder: true,
      _count: { select: { tracks: true } }
    }
  });

  return NextResponse.json(project, { status: 201 });
});
