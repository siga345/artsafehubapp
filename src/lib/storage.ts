import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";

export const MAX_AUDIO_UPLOAD_BYTES = 25 * 1024 * 1024;
export const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/mp4",
  "audio/x-m4a",
  "audio/webm",
  "audio/ogg",
  "audio/aac"
]);

export interface StorageProvider {
  saveFile(options: { buffer: Buffer; filename: string }): Promise<{ storageKey: string }>;
}

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath = "uploads") {
    this.basePath = basePath;
  }

  async saveFile({ buffer, filename }: { buffer: Buffer; filename: string }) {
    const uploadDir = path.join(process.cwd(), this.basePath);
    await fs.mkdir(uploadDir, { recursive: true });
    const storageKey = createStorageKey(filename);
    const filePath = path.join(uploadDir, storageKey);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
    return { storageKey };
  }
}

export class S3StorageProvider implements StorageProvider {
  async saveFile(_: { buffer: Buffer; filename: string }): Promise<{ storageKey: string }> {
    throw new Error(
      "S3 adapter is not wired yet. Implement upload in your infrastructure module and keep the StorageProvider contract."
    );
  }
}

export function assertValidAudioUpload(options: { mimeType: string; sizeBytes: number }) {
  if (!ALLOWED_AUDIO_MIME_TYPES.has(options.mimeType)) {
    throw new Error("Unsupported audio format");
  }

  if (options.sizeBytes <= 0 || options.sizeBytes > MAX_AUDIO_UPLOAD_BYTES) {
    throw new Error(`Audio file must be between 1 byte and ${MAX_AUDIO_UPLOAD_BYTES} bytes`);
  }
}

export function normalizeUploadFilename(filename: string) {
  const trimmed = filename.trim().toLowerCase();
  const withoutPath = trimmed.split(/[\\/]/).pop() ?? "audio";
  const sanitized = withoutPath.replace(/[^a-z0-9._-]/g, "-");
  return sanitized.replace(/-+/g, "-").replace(/^-|-$/g, "") || "audio";
}

function createStorageKey(filename: string) {
  const normalized = normalizeUploadFilename(filename);
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");

  return path.posix.join(year, month, day, `${randomUUID()}-${normalized}`);
}

function createStorageProvider() {
  const driver = process.env.STORAGE_DRIVER?.toLowerCase();
  if (driver === "s3") {
    return new S3StorageProvider();
  }

  return new LocalStorageProvider();
}

export const storageProvider = createStorageProvider();
