import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const folderSchema = z.object({
  title: z.string().min(1).max(80)
});

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const folders = await prisma.folder.findMany({
    where: { userId: user.id },
    include: { _count: { select: { tracks: true } } },
    orderBy: { updatedAt: "desc" }
  });

  return NextResponse.json(folders);
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, folderSchema);

  const existing = await prisma.folder.findFirst({
    where: { userId: user.id, title: body.title.trim() }
  });

  if (existing) {
    throw apiError(409, "Folder with this title already exists");
  }

  const folder = await prisma.folder.create({
    data: {
      userId: user.id,
      title: body.title.trim()
    }
  });

  return NextResponse.json(folder, { status: 201 });
});
