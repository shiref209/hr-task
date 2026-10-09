import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { roleSchema } from '@hr/types';
import { z } from 'zod';
import { UnauthorizedError } from '../common/errors/domain-errors';
import type { AuthenticatedRequest } from './auth-principal';
import { ACCESS_COOKIE, readCookie } from './auth-cookies';
import { IS_PUBLIC_KEY } from './public.decorator';

const claimsSchema = z.object({
  sub: z.string(),
  employeeId: z.string(),
  role: roleSchema,
});

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readCookie(request, ACCESS_COOKIE);
    if (!token) throw new UnauthorizedError('Authentication required.');
    const claims = await this.jwt
      .verifyAsync<object>(token, { algorithms: ['HS256'] })
      .then((payload) => claimsSchema.safeParse(payload))
      .catch(() => null);
    if (!claims?.success)
      throw new UnauthorizedError('Invalid or expired access token.');

    request.user = {
      userId: claims.data.sub,
      employeeId: claims.data.employeeId,
      role: claims.data.role,
    };
    return true;
  }
}
