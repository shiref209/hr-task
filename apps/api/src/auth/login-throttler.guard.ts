import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

// With several named throttlers the library suffixes the header ("Retry-After-ip"); clients expect the plain one.
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected setResponseHeader(
    res: Record<string, unknown>,
    name: string,
    value: string | number,
  ): void {
    if (name.startsWith('Retry-After'))
      super.setResponseHeader(res, 'Retry-After', value);
  }
}
