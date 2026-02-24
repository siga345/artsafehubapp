import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { assertFolderCreateAllowed, assertFolderMoveAllowed, listUserFoldersTree } from "@/lib/workspace-tree";

const groupBodySchema = z.object({
  source: z.object({
    type: z.enum(["project", "folder"]),
    id: z.string()
  }),
  target: z.object({
    type: z.enum(["project", "folder"]),
    id: z.string()
  }),
  currentParentFolderId: z.string().nullable().optional()
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, groupBodySchema);
  const currentParentFolderId = body.currentParentFolderId ?? null;

  if (body.source.id === body.target.id && body.source.type === body.target.type) {
    throw apiError(400, "Cannot group item with itself");
  }

  const folderTree = await listUserFoldersTree(user.id);
  if (currentParentFolderId && !folderTree.some((folder) => folder.id === currentParentFolderId)) {
    throw apiError(404, "Folder not found");
  }

  if (body.source.type === "folder" && body.target.type === "project") {
    throw apiError(400, "Unsupported grouping target");
  }

  const [sourceFolder, targetFolder, sourceProject, targetProject] = await Promise.all([
    body.source.type === "folder"
      ? prisma.folder.findFirst({ where: { id: body.source.id, userId: user.id } })
      : Promise.resolve(null),
    body.target.type === "folder"
      ? prisma.folder.findFirst({ where: { id: body.target.id, userId: user.id } })
      : Promise.resolve(null),
    body.source.type === "project"
      ? prisma.project.findFirst({ where: { id: body.source.id, userId: user.id } })
      : Promise.resolve(null),
    body.target.type === "project"
      ? prisma.project.findFirst({ where: { id: body.target.id, userId: user.id } })
      : Promise.resolve(null)
  ]);

  if (body.source.type === "folder" && !sourceFolder) throw apiError(404, "Folder not found");
  if (body.target.type === "folder" && !targetFolder) throw apiError(404, "Folder not found");
  if (body.source.type === "project" && !sourceProject) throw apiError(404, "Project not found");
  if (body.target.type === "project" && !targetProject) throw apiError(404, "Project not found");

  if (sourceFolder && sourceFolder.parentFolderId !== currentParentFolderId) {
    throw apiError(400, "Source folder is not in current level");
  }
  if (targetFolder && targetFolder.parentFolderId !== currentParentFolderId) {
    throw apiError(400, "Target folder is not in current level");
  }
  if (sourceProject && sourceProject.folderId !== currentParentFolderId) {
    throw apiError(400, "Source project is not in current level");
  }
  if (targetProject && targetProject.folderId !== currentParentFolderId) {
    throw apiError(400, "Target project is not in current level");
  }

  if (body.source.type === "project" && body.target.type === "project") {
    assertFolderCreateAllowed(folderTree, currentParentFolderId);

    const result = await prisma.$transaction(async (tx) => {
      const lastFolderSibling = await tx.folder.findFirst({
        where: { userId: user.id, parentFolderId: currentParentFolderId },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      });

      const createdFolder = await tx.folder.create({
        data: {
          userId: user.id,
          parentFolderId: currentParentFolderId,
          title: "untitled folder",
          sortIndex: (lastFolderSibling?.sortIndex ?? -1) + 1
        }
      });

      await tx.project.update({
        where: { id: targetProject!.id },
        data: { folderId: createdFolder.id, sortIndex: 0 }
      });
      await tx.project.update({
        where: { id: sourceProject!.id },
        data: { folderId: createdFolder.id, sortIndex: 1 }
      });

      return createdFolder;
    });

    return Response.json({ ok: true, createdFolderId: result.id });
  }

  if (body.source.type === "project" && body.target.type === "folder") {
    const target = targetFolder!;
    const source = sourceProject!;

    const updated = await prisma.$transaction(async (tx) => {
      const lastSibling = await tx.project.findFirst({
        where: { userId: user.id, folderId: target.id },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      });
      return tx.project.update({
        where: { id: source.id },
        data: {
          folderId: target.id,
          sortIndex: (lastSibling?.sortIndex ?? -1) + 1
        }
      });
    });

    return Response.json({ ok: true, projectId: updated.id });
  }

  if (body.source.type === "folder" && body.target.type === "folder") {
    const source = sourceFolder!;
    const target = targetFolder!;
    assertFolderMoveAllowed({
      nodes: folderTree,
      folderId: source.id,
      nextParentFolderId: target.id
    });

    const updated = await prisma.$transaction(async (tx) => {
      const lastSibling = await tx.folder.findFirst({
        where: { userId: user.id, parentFolderId: target.id },
        select: { sortIndex: true },
        orderBy: { sortIndex: "desc" }
      });

      return tx.folder.update({
        where: { id: source.id },
        data: {
          parentFolderId: target.id,
          sortIndex: (lastSibling?.sortIndex ?? -1) + 1
        }
      });
    });

    return Response.json({ ok: true, folderId: updated.id });
  }

  throw apiError(400, "Unsupported grouping combination");
});
