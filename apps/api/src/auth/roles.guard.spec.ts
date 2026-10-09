import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  ForbiddenError,
  UnauthorizedError,
} from '../common/errors/domain-errors';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { USER_REPOSITORY } from './users.repository';
import {
  aUserAccount,
  InMemoryUserRepository,
} from '../../test/fakes/in-memory-user-repository';

class Handlers {
  open(): void {}

  @Roles('HR')
  hrOnly(): void {}
}

const handler = (name: keyof Handlers): (() => void) =>
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the decorator metadata lives on this exact function
  Handlers.prototype[name];
const hrOnly = handler('hrOnly');
const open = handler('open');

const as = (role: 'HR' | 'EMPLOYEE', handler: () => void): ExecutionContext =>
  ({
    getHandler: () => handler,
    getClass: () => Handlers,
    switchToHttp: () => ({
      getRequest: () => ({
        user: { userId: 'u', employeeId: 'e', role },
      }),
    }),
  }) as unknown as ExecutionContext;

const hrAccount = () =>
  aUserAccount({ id: 'u', employee: { id: 'e', type: 'HR' } });

// The guard re-reads the user from USER_REPOSITORY on @Roles routes.
async function guard(
  users = new InMemoryUserRepository([hrAccount()]),
): Promise<RolesGuard> {
  const moduleRef = await Test.createTestingModule({
    providers: [RolesGuard, { provide: USER_REPOSITORY, useValue: users }],
  }).compile();
  return moduleRef.get(RolesGuard);
}
const check = async (g: RolesGuard, ctx: ExecutionContext) =>
  Promise.resolve().then(() => g.canActivate(ctx));

describe('RolesGuard', () => {
  it('allows HR on an @Roles("HR") route', async () => {
    await expect(check(await guard(), as('HR', hrOnly))).resolves.toBe(true);
  });

  it('rejects EMPLOYEE on an @Roles("HR") route with ForbiddenError', async () => {
    await expect(
      check(await guard(), as('EMPLOYEE', hrOnly)),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('allows any signed-in role on a route without @Roles', async () => {
    const g = await guard();

    await expect(check(g, as('EMPLOYEE', open))).resolves.toBe(true);
    await expect(check(g, as('HR', open))).resolves.toBe(true);
  });

  describe('immediate revocation on @Roles routes (DB re-check)', () => {
    it.each([
      ['inactive', { status: 'INACTIVE' as const }],
      ['deleted', { deletedAt: '2026-10-01T00:00:00.000Z' }],
    ])(
      'rejects an HR token with UnauthorizedError once the employee is %s',
      async (_label, change) => {
        const users = new InMemoryUserRepository([hrAccount()]);
        users.updateEmployee('u', change);

        await expect(
          check(await guard(users), as('HR', hrOnly)),
        ).rejects.toBeInstanceOf(UnauthorizedError);
      },
    );

    it('rejects an HR token with ForbiddenError once the employee was demoted', async () => {
      const users = new InMemoryUserRepository([hrAccount()]);
      users.updateEmployee('u', { type: 'EMPLOYEE' });

      await expect(
        check(await guard(users), as('HR', hrOnly)),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it('rejects a token whose user no longer exists with UnauthorizedError', async () => {
      await expect(
        check(await guard(new InMemoryUserRepository([])), as('HR', hrOnly)),
      ).rejects.toBeInstanceOf(UnauthorizedError);
    });

    it('does not hit the repository on routes without @Roles', async () => {
      const users = new InMemoryUserRepository([]);
      const findById = jest.spyOn(users, 'findById');

      await expect(check(await guard(users), as('HR', open))).resolves.toBe(
        true,
      );

      expect(findById).not.toHaveBeenCalled();
    });
  });
});
