export const FILE_STORAGE = Symbol('FILE_STORAGE');

export interface FileStorage {
  /** Stores the file and returns its public URL path. */
  save(buffer: Buffer, extension: string): Promise<string>;
  remove(url: string): Promise<void>;
}
