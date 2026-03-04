import { NextResponse } from "next/server";

import { apiError, withApiHandler } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/server-auth";
import { normalizeUploadFilename, storageProvider } from "@/lib/storage";

const MAX_AVATAR_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_AVATAR_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const POST = withApiHandler(async (request: Request) => {
  const user = await requireUser();
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    throw apiError(400, "Файл аватара не найден.");
  }

  if (!ALLOWED_AVATAR_MIME_TYPES.has(file.type)) {
    throw apiError(400, "Поддерживаются только JPG, PNG, WEBP и GIF.");
  }

  if (file.size <= 0 || file.size > MAX_AVATAR_UPLOAD_BYTES) {
    throw apiError(400, `Размер аватара должен быть не больше ${MAX_AVATAR_UPLOAD_BYTES / (1024 * 1024)} МБ.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await storageProvider.saveFile({
    buffer,
    filename: normalizeUploadFilename(file.name || "avatar")
  });

  const avatarUrl = `/api/uploads/${saved.storageKey}`;

  await prisma.user.update({
    where: { id: user.id },
    data: { avatarUrl }
  });

  return NextResponse.json({ avatarUrl });
});
