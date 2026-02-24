import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { assertFolderMoveAllowed, listUserFoldersTree } from "@/lib/workspace-tree";

export const POST = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: user.id },
    select: { id: true, parentFolderId: true }
  });
  if (!folder) {
    throw apiError(404, "Folder not found");
  }

  const tree = await listUserFoldersTree(user.id);
  if (folder.parentFolderId) {
    assertFolderMoveAllowed({
      nodes: tree,
      folderId: params.id,
      nextParentFolderId: folder.parentFolderId
    });
  }

  await prisma.$transaction(async (tx) => {
    const [childFolders, childProjects] = await Promise.all([
      tx.folder.findMany({
        where: { userId: user.id, parentFolderId: params.id },
        select: { id: true, sortIndex: true },
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }]
      }),
      tx.project.findMany({
        where: { userId: user.id, folderId: params.id },
        select: { id: true, sortIndex: true },
        orderBy: [{ sortIndex: "asc" }, { createdAt: "asc" }]
      })
    ]);

    const [lastFolderSibling, lastProjectSibling] = await Promise.all([
      tx.folder.findFirst({
        where: { userId: user.id, parentFolderId: folder.parentFolderId ?? null, id: { not: params.id } },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      }),
      tx.project.findFirst({
        where: { userId: user.id, folderId: folder.parentFolderId ?? null },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      })
    ]);

    let nextFolderSortIndex = (lastFolderSibling?.sortIndex ?? -1) + 1;
    for (const child of childFolders) {
      await tx.folder.update({
        where: { id: child.id },
        data: {
          parentFolderId: folder.parentFolderId ?? null,
          sortIndex: nextFolderSortIndex++
        }
      });
    }

    let nextProjectSortIndex = (lastProjectSibling?.sortIndex ?? -1) + 1;
    for (const project of childProjects) {
      await tx.project.update({
        where: { id: project.id },
        data: {
          folderId: folder.parentFolderId ?? null,
          sortIndex: nextProjectSortIndex++
        }
      });
    }

    // Legacy compatibility for tracks that still point directly to a folder.
    await tx.track.updateMany({
      where: { userId: user.id, folderId: params.id },
      data: { folderId: folder.parentFolderId ?? null }
    });
  });

  return NextResponse.json({ ok: true });
});
