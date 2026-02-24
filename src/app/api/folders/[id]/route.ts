import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { assertFolderMoveAllowed, collectFolderSubtreeIds, listUserFoldersTree } from "@/lib/workspace-tree";

const updateFolderSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  parentFolderId: z.string().optional().nullable(),
  pinned: z.boolean().optional()
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateFolderSchema);

  const folder = await prisma.folder.findFirst({ where: { id: params.id, userId: user.id } });
  if (!folder) {
    throw apiError(404, "Folder not found");
  }

  if (body.title !== undefined && !body.title.trim()) {
    throw apiError(400, "Folder title is required");
  }

  let nextParentFolderId: string | null | undefined = undefined;
  let nextSortIndex: number | undefined = undefined;

  if (body.parentFolderId !== undefined) {
    const tree = await listUserFoldersTree(user.id);
    assertFolderMoveAllowed({
      nodes: tree,
      folderId: params.id,
      nextParentFolderId: body.parentFolderId ?? null
    });

    nextParentFolderId = body.parentFolderId ?? null;
    const parentChanged = folder.parentFolderId !== nextParentFolderId;
    if (parentChanged) {
      const lastSibling = await prisma.folder.findFirst({
        where: { userId: user.id, parentFolderId: nextParentFolderId },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      });
      nextSortIndex = (lastSibling?.sortIndex ?? -1) + 1;
    }
  }

  const updated = await prisma.folder.update({
    where: { id: params.id },
    data: {
      title: body.title === undefined ? undefined : body.title.trim(),
      parentFolderId: nextParentFolderId,
      pinnedAt: body.pinned === undefined ? undefined : body.pinned ? new Date() : null,
      sortIndex: nextSortIndex
    }
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const url = new URL(request.url);
  const forceDelete = url.searchParams.get("force") === "1";
  const requestedMode = url.searchParams.get("mode");
  const mode = requestedMode ?? (forceDelete ? "delete_all" : null);
  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: user.id },
    include: {
      _count: { select: { projects: true, tracks: true, childFolders: true } },
      projects: { select: { id: true } }
    }
  });

  if (!folder) {
    throw apiError(404, "Folder not found");
  }

  const hasProjects = folder._count.projects > 0;
  const hasChildFolders = folder._count.childFolders > 0;
  const hasLegacyTracks = folder._count.tracks > 0;
  const isNotEmpty = hasProjects || hasChildFolders || hasLegacyTracks;

  if (!mode) {
    if (isNotEmpty) {
      throw apiError(400, "Folder is not empty", {
        code: "FOLDER_NOT_EMPTY",
        actions: ["empty", "delete_all"]
      });
    }
    await prisma.folder.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  }

  if (mode !== "delete" && mode !== "delete_all") {
    throw apiError(400, "Invalid delete mode");
  }

  if (mode === "delete") {
    if (isNotEmpty) {
      throw apiError(400, "Folder is not empty", {
        code: "FOLDER_NOT_EMPTY",
        actions: ["empty", "delete_all"]
      });
    }
    await prisma.folder.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  }

  if (mode === "delete_all") {
    const tree = await listUserFoldersTree(user.id);
    const subtreeFolderIds = collectFolderSubtreeIds(tree, params.id);
    const subtreeProjectIds = (
      await prisma.project.findMany({
        where: {
          userId: user.id,
          folderId: { in: subtreeFolderIds }
        },
        select: { id: true }
      })
    ).map((project) => project.id);

    await prisma.$transaction([
      prisma.track.deleteMany({
        where: {
          userId: user.id,
          OR: [
            { folderId: { in: subtreeFolderIds } },
            ...(subtreeProjectIds.length ? [{ projectId: { in: subtreeProjectIds } }] : [])
          ]
        }
      }),
      prisma.project.deleteMany({
        where: {
          userId: user.id,
          folderId: { in: subtreeFolderIds }
        }
      }),
      prisma.folder.deleteMany({
        where: {
          userId: user.id,
          id: { in: subtreeFolderIds }
        }
      })
    ]);
    return NextResponse.json({ ok: true });
  }

  throw apiError(400, "Invalid delete mode");
});
