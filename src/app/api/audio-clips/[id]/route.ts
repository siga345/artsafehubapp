import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

const updateDemoSchema = z.object({
  textNote: z.string().max(1000).optional().nullable()
});

export const GET = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const clip = await prisma.demo.findFirst({
    where: { id: params.id, track: { userId: user.id } },
    include: { track: true }
  });

  if (!clip) {
    throw apiError(404, "Demo not found");
  }

  return NextResponse.json(clip);
});

export const PATCH = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const body = await parseJsonBody(request, updateDemoSchema);
  const clip = await prisma.demo.findFirst({
    where: { id: params.id, track: { userId: user.id } }
  });

  if (!clip) {
    throw apiError(404, "Demo not found");
  }

  const track = await prisma.track.findUnique({
    where: { id: clip.trackId },
    select: { id: true, projectId: true }
  });

  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.demo.update({
      where: { id: params.id },
      data: { textNote: body.textNote ?? null }
    });

    if (track) {
      await tx.track.update({
        where: { id: track.id },
        data: { updatedAt: new Date() }
      });
      if (track.projectId) {
        await tx.project.update({
          where: { id: track.projectId },
          data: { updatedAt: new Date() }
        });
      }
    }

    return next;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const clip = await prisma.demo.findFirst({
    where: { id: params.id, track: { userId: user.id } }
  });

  if (!clip) {
    throw apiError(404, "Demo not found");
  }

  const track = await prisma.track.findUnique({
    where: { id: clip.trackId },
    select: { id: true, projectId: true, primaryDemoId: true }
  });

  await prisma.$transaction(async (tx) => {
    if (track) {
      const data: { primaryDemoId?: null; updatedAt: Date } = { updatedAt: new Date() };
      if (track.primaryDemoId === clip.id) {
        data.primaryDemoId = null;
      }

      await tx.track.update({
        where: { id: track.id },
        data
      });

      if (track.projectId) {
        await tx.project.update({
          where: { id: track.projectId },
          data: { updatedAt: new Date() }
        });
      }
    }

    await tx.demo.delete({ where: { id: params.id } });
  });
  return NextResponse.json({ ok: true });
});
