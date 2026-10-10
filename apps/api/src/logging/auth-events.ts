interface AuthEvents {
  'auth.login.succeeded': { userId: string };
  'auth.login.failed': Record<string, never>;
  'auth.login.rate_limited': Record<string, never>;
  'auth.refresh.reuse_detected': { userId: string };
  'auth.logout': { userId: string };
}

type LogMethod = (fields: object, message: string) => void;
// Satisfied by a plain pino logger and by nestjs-pino's PinoLogger.
interface EventLogger {
  info: LogMethod;
  warn: LogMethod;
}

// Fields are the user id at most: never an email or any other identifier.
export function logAuthEvent<E extends keyof AuthEvents>(
  logger: EventLogger,
  event: E,
  fields: AuthEvents[E],
): void {
  const level = event === 'auth.refresh.reuse_detected' ? 'warn' : 'info';
  logger[level](fields, event);
}
