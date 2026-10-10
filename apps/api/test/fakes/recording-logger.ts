export interface LogEntry {
  level: 'info' | 'warn' | 'error';
  obj: unknown;
  msg: string | undefined;
}

/** Stands in for nestjs-pino's `PinoLogger` (same `(obj, msg)` call shape) and records every call. */
export class RecordingLogger {
  readonly entries: LogEntry[] = [];

  info(obj: unknown, msg?: string): void {
    this.entries.push({ level: 'info', obj, msg });
  }
  warn(obj: unknown, msg?: string): void {
    this.entries.push({ level: 'warn', obj, msg });
  }
  error(obj: unknown, msg?: string): void {
    this.entries.push({ level: 'error', obj, msg });
  }

  event(name: string): LogEntry[] {
    return this.entries.filter((e) => e.msg === name);
  }

  /** Everything logged, as one string - for "never contains X" assertions. */
  text(): string {
    return JSON.stringify(this.entries);
  }
}
