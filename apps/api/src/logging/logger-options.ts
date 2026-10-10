import type { Options } from 'pino-http';
import type { AppConfig } from '../common/config';
import type { AuthenticatedRequest } from '../auth/auth-principal';
import { redact, serializers } from './redaction';

const NOT_REQUEST_LOGGED = /^\/(health|docs)\b/;

export function buildPinoHttpOptions(
  env: Pick<AppConfig, 'NODE_ENV' | 'LOG_LEVEL'>,
): Options {
  return {
    level: env.LOG_LEVEL,
    // Production writes single-line JSON to stdout; development gets readable output.
    transport:
      env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
    redact,
    serializers,
    customAttributeKeys: { responseTime: 'durationMs' },
    // Set by JwtAuthGuard, so only present when the access token was valid.
    customProps: (req) => ({
      userId: (req as AuthenticatedRequest).user?.userId,
    }),
    autoLogging: { ignore: (req) => NOT_REQUEST_LOGGED.test(req.url ?? '') },
    customLogLevel: (_req, res, error) =>
      error || res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
          ? 'warn'
          : 'info',
  };
}
