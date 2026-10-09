import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UnauthorizedError } from '../common/errors/domain-errors';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

const SECRET = 'unit-test-secret-0123456789abcdef-0123456789';
const jwt = new JwtService({ secret: SECRET });
const nowSeconds = () => Math.floor(Date.now() / 1000);
const claims = { sub: 'user-1', employeeId: 'emp-1', role: 'HR' };

class Handlers {
  protectedRoute(): void {}

  @Public()
  publicRoute(): void {}
}

const handler = (name: keyof Handlers): (() => void) =>
  // eslint-disable-next-line @typescript-eslint/unbound-method -- the decorator metadata lives on this exact function
  Handlers.prototype[name];
const protectedRoute = handler('protectedRoute');
const publicRoute = handler('publicRoute');

function context(
  handler: () => void,
  request: Record<string, unknown>,
): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => Handlers,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

async function guard(): Promise<JwtAuthGuard> {
  const moduleRef = await Test.createTestingModule({
    providers: [JwtAuthGuard, { provide: JwtService, useValue: jwt }],
  }).compile();
  return moduleRef.get(JwtAuthGuard);
}

const withCookie = (token?: string) => ({
  cookies: token === undefined ? {} : { access_token: token },
});
const check = async (g: JwtAuthGuard, ctx: ExecutionContext) =>
  Promise.resolve().then(() => g.canActivate(ctx));

describe('JwtAuthGuard', () => {
  it('lets a valid access-token cookie through and attaches the principal', async () => {
    const request = withCookie(jwt.sign(claims, { expiresIn: '15m' }));

    const allowed = await check(
      await guard(),
      context(protectedRoute, request),
    );

    expect(allowed).toBe(true);
    expect(request).toMatchObject({
      user: { userId: 'user-1', employeeId: 'emp-1', role: 'HR' },
    });
  });

  it('rejects a request without the cookie as unauthorized', async () => {
    await expect(
      check(await guard(), context(protectedRoute, withCookie())),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a request with no cookies object at all', async () => {
    await expect(
      check(await guard(), context(protectedRoute, {})),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign({ ...claims, exp: nowSeconds() - 60 });

    await expect(
      check(await guard(), context(protectedRoute, withCookie(expired))),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = new JwtService({ secret: 'x'.repeat(40) }).sign(claims, {
      expiresIn: '15m',
    });

    await expect(
      check(await guard(), context(protectedRoute, withCookie(forged))),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('rejects garbage in the cookie', async () => {
    await expect(
      check(await guard(), context(protectedRoute, withCookie('not-a-jwt'))),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('ignores the Authorization header (cookie only)', async () => {
    const request = {
      cookies: {},
      headers: {
        authorization: `Bearer ${jwt.sign(claims, { expiresIn: '15m' })}`,
      },
    };

    await expect(
      check(await guard(), context(protectedRoute, request)),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lets a @Public() route through without any token', async () => {
    const allowed = await check(
      await guard(),
      context(publicRoute, withCookie()),
    );

    expect(allowed).toBe(true);
  });
});
