import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getDemoUser } from "@/lib/demo";
import { storageProvider } from "@/lib/storage";

export async function GET() {
  const clips = await prisma.audioClip.findMany({
    orderBy: { createdAt: "desc" }
  });

  return NextResponse.json(clips);
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: "File is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now()}-${file.name}`;
  const stored = await storageProvider.saveFile({ buffer, filename });
  const user = await getDemoUser();

  const durationSec = Number(formData.get("durationSec") ?? 0);
  const noteText = String(formData.get("noteText") ?? "");
  const ideaId = formData.get("ideaId") ? String(formData.get("ideaId")) : null;
  const songId = formData.get("songId") ? String(formData.get("songId")) : null;

  const clip = await prisma.audioClip.create({
    data: {
      ownerId: user.id,
      ideaId,
      songId,
      filePath: stored.path,
      durationSec,
      noteText
    }
  });

  return NextResponse.json(clip, { status: 201 });
}
