import { NextResponse } from "next/server";

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

  const track = await prisma.track.findFirst({ where: { id: trackId, userId: user.id } });
  if (!track) {
    throw apiError(403, "Cannot attach demo to this track");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = normalizeUploadFilename(file.name);
  const stored = await storageProvider.saveFile({ buffer, filename });

  const clip = await prisma.demo.create({
    data: {
      trackId,
      audioUrl: stored.storageKey,
      duration: Math.max(0, Math.round(durationSec)),
      textNote: String(formData.get("noteText") ?? "") || null
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

  return NextResponse.json(clip, { status: 201 });
});
