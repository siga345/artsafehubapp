import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, withApiHandler } from "@/lib/api";
import { normalizeUploadFilename, storageProvider } from "@/lib/storage";
import { requireUser } from "@/lib/server-auth";

const MAX_WORLD_ASSET_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED_WORLD_ASSET_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const uploadKindSchema = z.enum(["background", "project_cover", "reference_image"]);

export const POST = withApiHandler(async (request: Request) => {
  await requireUser();

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = uploadKindSchema.safeParse(formData.get("kind"));

  if (!(file instanceof File)) {
    throw apiError(400, "Файл не найден.");
  }

  if (!kind.success) {
    throw apiError(400, "Не указан тип загружаемого файла.");
  }

  if (!ALLOWED_WORLD_ASSET_MIME_TYPES.has(file.type)) {
    throw apiError(400, "Поддерживаются только JPG, PNG, WEBP и GIF.");
  }

  if (file.size <= 0 || file.size > MAX_WORLD_ASSET_UPLOAD_BYTES) {
    throw apiError(400, `Размер файла должен быть не больше ${MAX_WORLD_ASSET_UPLOAD_BYTES / (1024 * 1024)} МБ.`);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const saved = await storageProvider.saveFile({
    buffer,
    filename: `${kind.data}-${normalizeUploadFilename(file.name || "world-asset")}`
  });

  return NextResponse.json({
    url: `/api/uploads/${saved.storageKey}`
  });
});
