import type { ExecutionContext } from '@nestjs/common';
import { normalizeIp, type ThrottlerOptions } from '@nestjs/throttler';
import { appConfig } from '../common/config';

const ONE_MINUTE_MS = 60_000;

type RequestLike = Record<string, unknown>;
// normalizeIp folds IPv6 to its /64 and unwraps IPv4-mapped addresses, so rotating addresses can't dodge the limit.
const ipOf = (req: RequestLike) => normalizeIp(String(req.ip));
const rawEmailOf = (req: RequestLike): unknown =>
  ((req.body ?? {}) as { email?: unknown }).email;
const emailOf = (req: RequestLike) => {
  const email = rawEmailOf(req);
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
};

// Three counters per attempt: per IP + email stops guessing one account from one place, per IP alone stops
// spraying many accounts, and per email alone (longer window) stops a distributed attack on one account.
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
  {
    name: 'email',
    ttl: 15 * ONE_MINUTE_MS,
    limit: appConfig.LOGIN_RATE_LIMIT_PER_EMAIL,
    getTracker: emailOf,
    // Without an email there is no account to protect; the validation pipe rejects the request anyway.
    skipIf: (context: ExecutionContext) =>
      typeof rawEmailOf(context.switchToHttp().getRequest<RequestLike>()) !==
      'string',
  },
];
