import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const updateFolderSchema = z.object({
  title: z.string().min(1).max(80)
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateFolderSchema);

  const folder = await prisma.folder.findFirst({ where: { id: params.id, userId: user.id } });
  if (!folder) {
    throw apiError(404, "Folder not found");
  }

  const duplicate = await prisma.folder.findFirst({
    where: {
      userId: user.id,
      title: body.title.trim(),
      id: { not: params.id }
    }
  });
  if (duplicate) {
    throw apiError(409, "Folder with this title already exists");
  }

  const updated = await prisma.folder.update({
    where: { id: params.id },
    data: { title: body.title.trim() }
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const folder = await prisma.folder.findFirst({
    where: { id: params.id, userId: user.id },
    include: { _count: { select: { tracks: true } } }
  });

  if (!folder) {
    throw apiError(404, "Folder not found");
  }

  if (folder._count.tracks > 0) {
    throw apiError(400, "Folder is not empty");
  }

  await prisma.folder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});
