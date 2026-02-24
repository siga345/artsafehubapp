import path from "path";
import { createReadStream, promises as fs } from "fs";
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

function parseRangeHeader(rangeHeader: string, fileSize: number) {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) return null;

  const startRaw = match[1];
  const endRaw = match[2];

  let start = startRaw ? Number(startRaw) : NaN;
  let end = endRaw ? Number(endRaw) : NaN;

  if (Number.isNaN(start) && Number.isNaN(end)) return null;

  if (Number.isNaN(start)) {
    const suffixLength = end;
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    if (!Number.isFinite(start) || start < 0) return null;
    if (Number.isNaN(end)) {
      end = fileSize - 1;
    }
  }

  if (!Number.isFinite(end) || end < 0) return null;
  if (start >= fileSize) return { invalid: true as const };

  end = Math.min(end, fileSize - 1);
  if (start > end) return null;

  return { start, end };
}

export const GET = withApiHandler(async (request: Request, { params }: { params: { id: string } }) => {
  const user = await requireUser();

  const demo = await prisma.demo.findFirst({
    where: { id: params.id, track: { userId: user.id } }
  });

  if (!demo) {
    throw apiError(404, "Demo not found");
  }

  const absolutePath = path.join(process.cwd(), "uploads", demo.audioUrl);
  const fileStat = await fs.stat(absolutePath);
  const fileSize = fileStat.size;
  const contentType = contentTypeByExt(demo.audioUrl);
  const commonHeaders = {
    "Content-Type": contentType,
    "Cache-Control": "private, max-age=60",
    "Accept-Ranges": "bytes"
  };

  const rangeHeader = request.headers.get("range");
  if (!rangeHeader) {
    const stream = createReadStream(absolutePath);
    return new NextResponse(stream as unknown as BodyInit, {
      status: 200,
      headers: {
        ...commonHeaders,
        "Content-Length": String(fileSize)
      }
    });
  }

  const parsedRange = parseRangeHeader(rangeHeader, fileSize);
  if (!parsedRange || ("invalid" in parsedRange && parsedRange.invalid)) {
    return new NextResponse(null, {
      status: 416,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes */${fileSize}`
      }
    });
  }

  const { start, end } = parsedRange;
  const chunkSize = end - start + 1;
  const stream = createReadStream(absolutePath, { start, end });

  return new NextResponse(stream as unknown as BodyInit, {
    status: 206,
    headers: {
      ...commonHeaders,
      "Content-Length": String(chunkSize),
      "Content-Range": `bytes ${start}-${end}/${fileSize}`
    }
  });
});
