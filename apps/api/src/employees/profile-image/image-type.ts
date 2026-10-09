export type ImageType = 'jpeg' | 'png' | 'webp';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) =>
  bytes.every((byte, i) => buffer[offset + i] === byte);

const ascii = (text: string) => [...Buffer.from(text, 'ascii')];

/** Identifies the format from magic bytes only; the client-declared mimetype and file name are not trusted. */
export function detectImageType(buffer: Buffer): ImageType | null {
  if (startsWith(buffer, PNG)) return 'png';
  if (startsWith(buffer, JPEG)) return 'jpeg';
  if (startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WEBP'), 8))
    return 'webp';
  return null;
}
