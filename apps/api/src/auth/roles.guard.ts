import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@hr/types';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../common/errors/domain-errors';
import type { AuthenticatedRequest } from './auth-principal';
import { ROLES_KEY } from './roles.decorator';
import {
  canSignIn,
  USER_REPOSITORY,
  type UserRepository,
} from './users.repository';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!roles) return true;
    const { user } = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!user || !roles.includes(user.role)) throw this.denied();

    // Restricted routes re-read the user so a demotion or deactivation applies at once, not after the token expires.
    const account = await this.users.findById(user.userId);
    if (!account || !canSignIn(account))
      throw new UnauthorizedError('Your account is no longer active.');
    if (!roles.includes(account.employee.type)) throw this.denied();
    return true;
  }

  private denied(): ForbiddenError {
    return new ForbiddenError('You do not have access to this resource.');
  }
}
