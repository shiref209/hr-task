import type { ThrottlerOptions } from '@nestjs/throttler';
import { appConfig } from '../common/config';

const ONE_MINUTE_MS = 60_000;

type RequestLike = Record<string, unknown>;
const ipOf = (req: RequestLike) => String(req.ip);
const emailOf = (req: RequestLike) => {
  const { email } = (req.body ?? {}) as { email?: unknown };
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

// Two counters per attempt: per IP + email stops guessing one account, per IP alone stops spraying many accounts.
export const loginThrottlers: ThrottlerOptions[] = [
  {
    name: 'ip-and-email',
    ttl: ONE_MINUTE_MS,
    limit: appConfig.LOGIN_RATE_LIMIT_PER_MINUTE,
    getTracker: (req) => `${ipOf(req)}|${emailOf(req)}`,
  },
  {
    name: 'ip',
    ttl: ONE_MINUTE_MS,
    limit: appConfig.LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE,
    getTracker: ipOf,
  },
];
