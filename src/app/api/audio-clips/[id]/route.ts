import { NextResponse } from "next/server";
import { RecommendationSource, TrackDecisionType } from "@prisma/client";
import { z } from "zod";

import { apiError, parseJsonBody, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createTrackDecision } from "@/lib/recommendation-logging";
import { requireUser } from "@/lib/server-auth";
import { serializeVersionReflection } from "@/lib/track-workbench";

const updateDemoSchema = z.object({
  textNote: z.string().max(1000).optional().nullable(),
  versionReflection: z
    .object({
      whyMade: z.string().trim().max(1000).optional().nullable(),
      whatChanged: z.string().trim().max(2000).optional().nullable(),
      whatNotWorking: z.string().trim().max(2000).optional().nullable()
    })
    .optional()
});

export const GET = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();
  const clip = await prisma.demo.findFirst({
    where: { id: params.id, track: { userId: user.id } },
    include: { track: true, versionReflection: true }
  });

  if (!clip) {
    throw apiError(404, "Demo not found");
  }

  return NextResponse.json({
    ...clip,
    createdAt: clip.createdAt.toISOString(),
    releaseDate: clip.releaseDate ? clip.releaseDate.toISOString().slice(0, 10) : null,
    detectedAt: clip.detectedAt?.toISOString() ?? null,
    versionReflection: serializeVersionReflection(clip.versionReflection, clip.textNote)
  });
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
    const reflectionPayload = body.versionReflection
      ? {
          whyMade: body.versionReflection.whyMade?.trim() || null,
          whatChanged: body.versionReflection.whatChanged?.trim() || null,
          whatNotWorking: body.versionReflection.whatNotWorking?.trim() || null
        }
      : null;
    const hasReflectionFields = Boolean(
      reflectionPayload &&
        (reflectionPayload.whyMade || reflectionPayload.whatChanged || reflectionPayload.whatNotWorking)
    );

    const next = await tx.demo.update({
      where: { id: params.id },
      data: { textNote: body.textNote ?? null },
      include: { versionReflection: true }
    });

    if (body.versionReflection !== undefined) {
      if (hasReflectionFields && reflectionPayload) {
        await tx.versionReflection.upsert({
          where: { demoId: params.id },
          update: reflectionPayload,
          create: {
            demoId: params.id,
            ...reflectionPayload
          }
        });
        await createTrackDecision(tx, {
          userId: user.id,
          trackId: clip.trackId,
          demoId: params.id,
          type: TrackDecisionType.REFLECTION_CAPTURED,
          source: RecommendationSource.MANUAL,
          summary: reflectionPayload.whyMade || "Reflection captured",
          reason: reflectionPayload.whatNotWorking || reflectionPayload.whatChanged || null
        });
      } else {
        await tx.versionReflection.deleteMany({
          where: { demoId: params.id }
        });
      }
    }

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

    return tx.demo.findUniqueOrThrow({
      where: { id: params.id },
      include: { versionReflection: true }
    });
  });

  return NextResponse.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    releaseDate: updated.releaseDate ? updated.releaseDate.toISOString().slice(0, 10) : null,
    detectedAt: updated.detectedAt?.toISOString() ?? null,
    versionReflection: serializeVersionReflection(updated.versionReflection, updated.textNote)
  });
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
