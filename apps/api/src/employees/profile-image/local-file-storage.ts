import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import type { FileStorage } from './file-storage';

const SUBDIR = 'employees';

export class LocalFileStorage implements FileStorage {
  constructor(private readonly rootDir: string) {}

  async save(buffer: Buffer, extension: string): Promise<string> {
    const name = `${randomUUID()}.${extension}`;
    await mkdir(join(this.rootDir, SUBDIR), { recursive: true });
    await writeFile(join(this.rootDir, SUBDIR, name), buffer);
    return `/uploads/${SUBDIR}/${name}`;
  }

  async remove(url: string): Promise<void> {
    // basename keeps a tampered URL from escaping the uploads directory
    await rm(join(this.rootDir, SUBDIR, basename(url)), { force: true });
  }
}
