import { Writable } from 'node:stream';

/** A pino destination that keeps every line in memory, so tests can inspect real log output. */
export class LogCapture {
  private readonly chunks: string[] = [];

  readonly stream = new Writable({
    write: (chunk: Buffer, _encoding, done) => {
      this.chunks.push(chunk.toString());
      done();
    },
  });

  clear(): void {
    this.chunks.length = 0;
  }

  text(): string {
    return this.chunks.join('');
  }

  lines(): Record<string, unknown>[] {
    return this.text()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}
