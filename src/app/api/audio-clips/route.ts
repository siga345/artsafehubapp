import { NextResponse } from "next/server";
import { DemoVersionType } from "@prisma/client";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import {
  assertValidAudioUpload,
  normalizeUploadFilename,
  storageProvider
} from "@/lib/storage";

export const GET = withApiHandler(async () => {
  const user = await requireUser();

  const clips = await prisma.demo.findMany({
    where: { track: { userId: user.id } },
    include: {
      track: {
        select: {
          id: true,
          title: true
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(clips);
});

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    throw apiError(400, "File is required");
  }

  try {
    assertValidAudioUpload({ mimeType: file.type, sizeBytes: file.size });
  } catch (error) {
    throw apiError(400, error instanceof Error ? error.message : "Invalid audio upload");
  }

  const durationSec = Number(formData.get("durationSec") ?? 0);
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    throw apiError(400, "durationSec must be a positive number");
  }

  const trackId = formData.get("trackId") ? String(formData.get("trackId")) : null;
  if (!trackId) {
    throw apiError(400, "trackId is required");
  }

  const versionTypeRaw = String(formData.get("versionType") ?? "DEMO");
  const allowedVersionTypes = new Set<DemoVersionType>([
    "IDEA_TEXT",
    "DEMO",
    "ARRANGEMENT",
    "NO_MIX",
    "MIXED",
    "MASTERED"
  ]);
  if (!allowedVersionTypes.has(versionTypeRaw as DemoVersionType)) {
    throw apiError(400, "Invalid versionType");
  }

  const track = await prisma.track.findFirst({ where: { id: trackId, userId: user.id } });
  if (!track) {
    throw apiError(403, "Cannot attach demo to this track");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = normalizeUploadFilename(file.name);
  const stored = await storageProvider.saveFile({ buffer, filename });

  const clip = await prisma.$transaction(async (tx) => {
    await tx.demo.updateMany({
      where: { trackId, versionType: versionTypeRaw as DemoVersionType },
      data: { sortIndex: { increment: 1 } }
    });

    const createdClip = await tx.demo.create({
      data: {
        trackId,
        audioUrl: stored.storageKey,
        duration: Math.max(0, Math.round(durationSec)),
        textNote: String(formData.get("noteText") ?? "") || null,
        versionType: versionTypeRaw as DemoVersionType,
        sortIndex: 0
      },
      include: {
        track: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    await tx.track.update({
      where: { id: trackId },
      data: { updatedAt: new Date() }
    });

    if (track.projectId) {
      await tx.project.update({
        where: { id: track.projectId },
        data: { updatedAt: new Date() }
      });
    }

    return createdClip;
  });

  return NextResponse.json(clip, { status: 201 });
});
