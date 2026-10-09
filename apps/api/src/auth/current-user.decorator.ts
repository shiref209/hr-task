import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthPrincipal } from './auth-principal';

// Only valid behind JwtAuthGuard, which always sets `user` on non-public routes.
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthPrincipal | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
