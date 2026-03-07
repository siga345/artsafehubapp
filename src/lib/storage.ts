import { randomUUID } from "crypto";
import path from "path";
import { promises as fs } from "fs";

import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as awsGetSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_AUDIO_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;
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
  getSignedUrl(storageKey: string, expiresIn?: number): Promise<string>;
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

  async getSignedUrl(storageKey: string): Promise<string> {
    return `/api/uploads/${storageKey}`;
  }
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.S3_BUCKET!;
    this.client = new S3Client({
      region: process.env.S3_REGION ?? "us-east-1",
      ...(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            }
          }
        : {})
    });
  }

  async saveFile({ buffer, filename }: { buffer: Buffer; filename: string }): Promise<{ storageKey: string }> {
    const storageKey = createStorageKey(filename);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        Body: buffer,
        ContentType: contentTypeFromFilename(filename)
      })
    );
    return { storageKey };
  }

  async getSignedUrl(storageKey: string, expiresIn = 3600): Promise<string> {
    return awsGetSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      }),
      { expiresIn }
    );
  }
}

function contentTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".m4a": "audio/mp4",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
    ".webm": "audio/webm",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif"
  };
  return map[ext] ?? "application/octet-stream";
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

function createStorageProvider(): StorageProvider {
  const driver = process.env.STORAGE_DRIVER?.toLowerCase();
  if (driver === "s3") {
    return new S3StorageProvider();
  }

  return new LocalStorageProvider();
}

export const storageProvider = createStorageProvider();
