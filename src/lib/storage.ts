import path from "path";
import { promises as fs } from "fs";

export interface StorageProvider {
  saveFile(options: { buffer: Buffer; filename: string }): Promise<{ path: string }>;
}

export class LocalStorageProvider implements StorageProvider {
  private basePath: string;

  constructor(basePath = "uploads") {
    this.basePath = basePath;
  }

  async saveFile({ buffer, filename }: { buffer: Buffer; filename: string }) {
    const uploadDir = path.join(process.cwd(), this.basePath);
    await fs.mkdir(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, buffer);
    return { path: filePath };
  }
}

export const storageProvider = new LocalStorageProvider();
