import { detectImageType } from './image-type';

const bytes = (...values: number[]) => Buffer.from(values);
const ascii = (text: string) => [...Buffer.from(text, 'ascii')];

describe('detectImageType', () => {
  it('detects jpeg by its FF D8 FF signature', () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10))).toBe(
      'jpeg',
    );
  });

  it('detects png by its 8-byte signature', () => {
    expect(
      detectImageType(
        bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0),
      ),
    ).toBe('png');
  });

  it('detects webp by RIFF....WEBP', () => {
    const webp = bytes(
      ...ascii('RIFF'),
      0x24,
      0,
      0,
      0,
      ...ascii('WEBP'),
      ...ascii('VP8 '),
    );

    expect(detectImageType(webp)).toBe('webp');
  });

  it('rejects a RIFF container that is not WEBP', () => {
    const wav = bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WAVE'));

    expect(detectImageType(wav)).toBeNull();
  });

  it('rejects gif', () => {
    expect(detectImageType(Buffer.from('GIF89a......'))).toBeNull();
  });

  it('rejects text content', () => {
    expect(detectImageType(Buffer.from('this is just a text file'))).toBeNull();
  });

  it('rejects an empty buffer', () => {
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('rejects a buffer shorter than the signature', () => {
    expect(detectImageType(bytes(0x89, 0x50))).toBeNull();
  });

  it('rejects a truncated png signature', () => {
    expect(
      detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a)),
    ).toBeNull();
  });

  it('rejects a truncated RIFF header', () => {
    expect(detectImageType(Buffer.from('RIFF'))).toBeNull();
  });
});
