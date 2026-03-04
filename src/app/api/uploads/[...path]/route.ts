import path from "path";
import { promises as fs } from "fs";

import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";

const MIME_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif"
};

export const GET = withApiHandler(async (_request: Request, context: { params: { path: string[] } }) => {
  const segments = context.params.path ?? [];

  if (!segments.length || segments.some((segment) => segment.includes(".."))) {
    throw apiError(400, "Некорректный путь к файлу.");
  }

  const relativePath = segments.join(path.sep);
  const absolutePath = path.join(process.cwd(), "uploads", relativePath);
  const fileBuffer = await fs.readFile(absolutePath);
  const ext = path.extname(absolutePath).toLowerCase();
  const contentType = MIME_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  return new NextResponse(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
});
