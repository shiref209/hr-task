import { randomUUID } from 'node:crypto';
import type { FileStorage } from '../../src/employees/profile-image/file-storage';

export interface SavedFile {
  url: string;
  buffer: Buffer;
  extension: string;
}

export class InMemoryFileStorage implements FileStorage {
  readonly saved: SavedFile[] = [];
  readonly removed: string[] = [];
  /** Shared, ordered event log ('save' / 'remove') so tests can assert call order across fakes. */
  log: string[] = [];

  async save(buffer: Buffer, extension: string): Promise<string> {
    const url = `/uploads/employees/${randomUUID()}.${extension}`;
    this.saved.push({ url, buffer, extension });
    this.log.push('save');
    return url;
  }

  async remove(url: string): Promise<void> {
    this.removed.push(url);
    this.log.push('remove');
  }
}
