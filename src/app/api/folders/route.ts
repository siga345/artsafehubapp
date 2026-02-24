import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { assertFolderCreateAllowed, listUserFoldersTree } from "@/lib/workspace-tree";

const folderSchema = z.object({
  title: z.string().min(1).max(80),
  parentFolderId: z.string().optional().nullable()
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const folders = await prisma.folder.findMany({
    where: { userId: user.id },
    include: { _count: { select: { projects: true, tracks: true, childFolders: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(folders);
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, folderSchema);
  const title = body.title.trim();

  if (!title) {
    throw apiError(400, "Folder title is required");
  }

  const tree = await listUserFoldersTree(user.id);
  if (body.parentFolderId && !tree.some((folder) => folder.id === body.parentFolderId)) {
    throw apiError(403, "Cannot use this folder");
  }
  assertFolderCreateAllowed(tree, body.parentFolderId ?? null);

  const lastSibling = await prisma.folder.findFirst({
    where: { userId: user.id, parentFolderId: body.parentFolderId ?? null },
    select: { sortIndex: true },
    orderBy: { sortIndex: "desc" }
  });

  const folder = await prisma.folder.create({
    data: {
      userId: user.id,
      title,
      parentFolderId: body.parentFolderId ?? null,
      sortIndex: (lastSibling?.sortIndex ?? -1) + 1
    }
  });

  return NextResponse.json(folder, { status: 201 });
});
