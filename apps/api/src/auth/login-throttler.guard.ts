import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { PinoLogger } from 'nestjs-pino';
import { logAuthEvent } from '../logging/auth-events';

// With several named throttlers the library suffixes the header ("Retry-After-ip"); clients expect the plain one.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  @Inject(PinoLogger) private readonly eventLogger!: PinoLogger;

  protected throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    logAuthEvent(this.eventLogger, 'auth.login.rate_limited', {});
    return super.throwThrottlingException(context, detail);
  }

  protected setResponseHeader(
    res: Record<string, unknown>,
    name: string,
    value: string | number,
  ): void {
    if (name.startsWith('Retry-After'))
      super.setResponseHeader(res, 'Retry-After', value);
  }
}
