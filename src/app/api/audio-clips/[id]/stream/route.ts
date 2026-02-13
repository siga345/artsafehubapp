import path from "path";
import { promises as fs } from "fs";
import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";

function contentTypeByExt(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".aac") return "audio/aac";
  return "audio/webm";
}

export const GET = withApiHandler(async (_: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const demo = await prisma.demo.findFirst({
    where: { id: params.id, track: { userId: user.id } }
  });

  if (!demo) {
    throw apiError(404, "Demo not found");
  }

  const absolutePath = path.join(process.cwd(), "uploads", demo.audioUrl);
  const fileBuffer = await fs.readFile(absolutePath);

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentTypeByExt(demo.audioUrl),
      "Cache-Control": "private, max-age=60"
    }
  });
});
