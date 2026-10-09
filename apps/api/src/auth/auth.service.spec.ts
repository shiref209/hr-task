import { createHash } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { FakePasswordHasher } from '../../test/fakes/fake-password-hasher';
import { InMemoryRefreshTokenRepository } from '../../test/fakes/in-memory-refresh-token-repository';
import {
  aUserAccount,
  InMemoryUserRepository,
} from '../../test/fakes/in-memory-user-repository';
import { CLOCK } from '../common/clock';
import { AuthService } from './auth.service';
import { InvalidCredentialsError, SessionExpiredError } from './auth.errors';
import { PASSWORD_HASHER } from './password-hasher';
import { REFRESH_TOKEN_REPOSITORY } from './refresh-tokens.repository';
import { USER_REPOSITORY } from './users.repository';

const NOW = new Date('2026-10-08T10:00:00.000Z');
const SECRET = 'unit-test-secret-0123456789abcdef-0123456789';
const PASSWORD = 'test@123';
const DAY = 24 * 60 * 60 * 1000;
const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex');

async function setup(users: ReturnType<typeof aUserAccount>[] = []) {
  let current = NOW;
  const clock = { now: () => new Date(current) };
  const advanceTo = (instant: Date) => {
    current = instant;
  };
  const hasher = new FakePasswordHasher();
  const verify = jest.spyOn(hasher, 'verify');
  const userRepo = new InMemoryUserRepository(users);
  const tokens = new InMemoryRefreshTokenRepository();
  const jwt = new JwtService({ secret: SECRET });
  const moduleRef = await Test.createTestingModule({
    providers: [
      AuthService,
      { provide: USER_REPOSITORY, useValue: userRepo },
      { provide: REFRESH_TOKEN_REPOSITORY, useValue: tokens },
      { provide: PASSWORD_HASHER, useValue: hasher },
      { provide: JwtService, useValue: jwt },
      { provide: CLOCK, useValue: clock },
    ],
  }).compile();
  return {
    service: moduleRef.get(AuthService),
    userRepo,
    tokens,
    jwt,
    verify,
    advanceTo,
  };
}

const aHr = (overrides: Parameters<typeof aUserAccount>[0] = {}) =>
  aUserAccount({
    email: 'test@hr.com',
    passwordHash: `fake$${PASSWORD}`,
    ...overrides,
    employee: { type: 'HR', ...overrides.employee },
  });

describe('AuthService', () => {
  describe('login', () => {
    it('returns the user, both tokens and the refresh expiry on success', async () => {
      const account = aHr();
      const { service } = await setup([account]);

      const result = await service.login('test@hr.com', PASSWORD);

      expect(result.user).toMatchObject({
        id: account.id,
        email: 'test@hr.com',
        role: 'HR',
      });
      expect(result.user.employee).toMatchObject({
        id: account.employee.id,
        fullName: account.employee.fullName,
      });
      expect(result.accessToken).toEqual(expect.any(String));
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshExpiresAt).toEqual(
        new Date('2026-10-15T10:00:00.000Z'),
      );
    });

    it('never exposes the password hash on the returned user', async () => {
      const { service } = await setup([aHr()]);

      const result = await service.login('test@hr.com', PASSWORD);

      expect(JSON.stringify(result.user)).not.toMatch(/passwordHash|fake\$/);
    });

    it('uses the employee type as the role', async () => {
      const { service } = await setup([
        aHr({ email: 'test@employee.com', employee: { type: 'EMPLOYEE' } }),
      ]);

      const result = await service.login('test@employee.com', PASSWORD);

      expect(result.user.role).toBe('EMPLOYEE');
    });

    it('signs an access token with sub, employeeId and role that lasts 15 minutes', async () => {
      const account = aHr();
      const { service, jwt } = await setup([account]);

      const { accessToken } = await service.login('test@hr.com', PASSWORD);

      // Verify the signature, but ignore expiry: the fixed clock is in the past.
      const claims = jwt.verify<{
        sub: string;
        employeeId: string;
        role: string;
        iat: number;
        exp: number;
      }>(accessToken, { ignoreExpiration: true });
      expect(claims).toMatchObject({
        sub: account.id,
        employeeId: account.employee.id,
        role: 'HR',
      });
      expect(claims.exp - claims.iat).toBe(15 * 60);
    });

    it('stores only the SHA-256 hash of the refresh token', async () => {
      const account = aHr();
      const { service, tokens } = await setup([account]);

      const { refreshToken } = await service.login('test@hr.com', PASSWORD);

      expect(tokens.all).toHaveLength(1);
      expect(tokens.all[0]).toMatchObject({
        userId: account.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date('2026-10-15T10:00:00.000Z'),
        revokedAt: null,
        sessionStartedAt: NOW,
      });
      expect(JSON.stringify(tokens.all)).not.toContain(refreshToken);
    });

    it('issues a different refresh token for each login (one row per device)', async () => {
      const { service, tokens } = await setup([aHr()]);

      const first = await service.login('test@hr.com', PASSWORD);
      const second = await service.login('test@hr.com', PASSWORD);

      expect(first.refreshToken).not.toBe(second.refreshToken);
      expect(tokens.all).toHaveLength(2);
    });

    it("purges only the user's expired rows on login, keeping live and revoked rows and other users' rows", async () => {
      const mine = aHr();
      const other = aHr({ email: 'other@hr.com' });
      const { service, tokens } = await setup([mine, other]);
      const live = await service.login('test@hr.com', PASSWORD);
      const rotatedAway = await service.login('test@hr.com', PASSWORD);
      const replacement = await service.refresh(rotatedAway.refreshToken); // leaves a revoked row
      await tokens.create({
        userId: mine.id,
        tokenHash: sha256('expired-one'),
        expiresAt: new Date(NOW.getTime() - 1000),
        sessionStartedAt: new Date(NOW.getTime() - 8 * DAY),
      });
      await tokens.create({
        userId: other.id,
        tokenHash: sha256('others-expired'),
        expiresAt: new Date(NOW.getTime() - 1000),
        sessionStartedAt: new Date(NOW.getTime() - 8 * DAY),
      });

      const fresh = await service.login('test@hr.com', PASSWORD);

      const mineLeft = tokens.all
        .filter((r) => r.userId === mine.id)
        .map((r) => r.tokenHash)
        .sort();
      // Only the expired row goes; the revoked one stays so its reuse can still be detected.
      expect(mineLeft).toHaveLength(4);
      expect(mineLeft).toContain(sha256(replacement.refreshToken));
      expect(mineLeft).toContain(sha256(rotatedAway.refreshToken));
      expect(mineLeft).toContain(sha256(live.refreshToken));
      expect(mineLeft).toContain(sha256(fresh.refreshToken));
      expect(mineLeft).not.toContain(sha256('expired-one'));
      expect(
        tokens.all.some((r) => r.tokenHash === sha256('others-expired')),
      ).toBe(true);
    });

    it('still detects reuse of a rotated token after a later login purged expired rows', async () => {
      const { service, tokens } = await setup([aHr()]);
      const first = await service.login('test@hr.com', PASSWORD);
      const second = await service.refresh(first.refreshToken); // token1 revoked
      const third = await service.login('test@hr.com', PASSWORD); // purge runs

      await expect(service.refresh(first.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );

      expect(tokens.all.every((r) => r.revokedAt !== null)).toBe(true);
      await expect(service.refresh(second.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
      await expect(service.refresh(third.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
    });

    it.each([
      ['a wrong password', 'test@hr.com', 'nope', {}],
      ['an unknown email', 'ghost@hr.com', PASSWORD, {}],
      [
        'an inactive employee',
        'test@hr.com',
        PASSWORD,
        { employee: { status: 'INACTIVE' as const } },
      ],
      [
        'a deleted employee',
        'test@hr.com',
        PASSWORD,
        { employee: { deletedAt: '2026-01-01T00:00:00.000Z' } },
      ],
    ])(
      'fails with the same InvalidCredentialsError for %s',
      async (_label, email, password, overrides) => {
        const { service, tokens } = await setup([aHr(overrides)]);

        const attempt = service.login(email, password);

        await expect(attempt).rejects.toBeInstanceOf(InvalidCredentialsError);
        await expect(attempt).rejects.toThrow('Invalid email or password');
        expect(tokens.all).toEqual([]);
      },
    );

    it('still verifies against a dummy hash when the email is unknown', async () => {
      const { service, verify } = await setup([aHr()]);

      await expect(service.login('ghost@hr.com', 'whatever')).rejects.toThrow();

      expect(verify).toHaveBeenCalledTimes(1);
      expect(verify).toHaveBeenCalledWith('whatever', expect.any(String));
    });

    it('verifies exactly once for a wrong password too', async () => {
      const { service, verify } = await setup([aHr()]);

      await expect(service.login('test@hr.com', 'nope')).rejects.toThrow();

      expect(verify).toHaveBeenCalledTimes(1);
    });
  });

  describe('refresh', () => {
    it('rotates: revokes the old row, keeps it, and stores a new hashed one', async () => {
      const account = aHr();
      const { service, tokens } = await setup([account]);
      const login = await service.login('test@hr.com', PASSWORD);

      const rotated = await service.refresh(login.refreshToken);

      expect(rotated.user).toMatchObject({ id: account.id, role: 'HR' });
      expect(rotated.refreshToken).not.toBe(login.refreshToken);
      expect(rotated.accessToken).not.toBe(login.accessToken);
      const byHash = (raw: string) =>
        tokens.all.find((r) => r.tokenHash === sha256(raw));
      expect(byHash(login.refreshToken)?.revokedAt).toBeInstanceOf(Date);
      expect(byHash(rotated.refreshToken)).toMatchObject({
        userId: account.id,
        revokedAt: null,
        expiresAt: rotated.refreshExpiresAt,
      });
      expect(tokens.all).toHaveLength(2);
      expect(JSON.stringify(tokens.all)).not.toContain(rotated.refreshToken);
    });

    it('rejects the old token once it has been rotated', async () => {
      const { service } = await setup([aHr()]);
      const login = await service.login('test@hr.com', PASSWORD);
      await service.refresh(login.refreshToken);

      await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
    });

    it('revokes every session of the user when a rotated token is reused', async () => {
      const account = aHr();
      const { service, tokens } = await setup([account]);
      const deviceA = await service.login('test@hr.com', PASSWORD);
      const deviceB = await service.login('test@hr.com', PASSWORD);
      const rotated = await service.refresh(deviceA.refreshToken);

      await expect(
        service.refresh(deviceA.refreshToken),
      ).rejects.toBeInstanceOf(SessionExpiredError);

      expect(tokens.all.every((r) => r.revokedAt !== null)).toBe(true);
      await expect(
        service.refresh(rotated.refreshToken),
      ).rejects.toBeInstanceOf(SessionExpiredError);
      await expect(
        service.refresh(deviceB.refreshToken),
      ).rejects.toBeInstanceOf(SessionExpiredError);
    });

    it('does not touch other users when a token reuse is detected', async () => {
      const mine = aHr();
      const other = aHr({ email: 'other@hr.com' });
      const { service, tokens } = await setup([mine, other]);
      const stolen = await service.login('test@hr.com', PASSWORD);
      await service.login('other@hr.com', PASSWORD);
      await service.refresh(stolen.refreshToken);

      await expect(service.refresh(stolen.refreshToken)).rejects.toThrow();

      const othersRows = tokens.all.filter((r) => r.userId === other.id);
      expect(othersRows.every((r) => r.revokedAt === null)).toBe(true);
    });

    it('fails for an unknown token without revoking anything', async () => {
      const { service, tokens } = await setup([aHr()]);
      await service.login('test@hr.com', PASSWORD);

      await expect(service.refresh('never-issued')).rejects.toBeInstanceOf(
        SessionExpiredError,
      );

      expect(tokens.all.every((r) => r.revokedAt === null)).toBe(true);
    });

    it('deletes an expired token and fails', async () => {
      const { service, tokens, advanceTo } = await setup([aHr()]);
      const login = await service.login('test@hr.com', PASSWORD);
      advanceTo(new Date('2026-10-16T10:00:00.000Z'));

      await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );

      expect(tokens.all).toEqual([]);
    });

    it.each([
      ['inactive', { status: 'INACTIVE' as const }],
      ['deleted', { deletedAt: '2026-10-01T00:00:00.000Z' }],
    ])('fails when the employee became %s', async (_label, change) => {
      const account = aHr();
      const { service, userRepo } = await setup([account]);
      const login = await service.login('test@hr.com', PASSWORD);
      userRepo.updateEmployee(account.id, change);

      await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
    });

    it('lets exactly one of two concurrent refreshes with the same token win and revokes every session', async () => {
      const { service, tokens } = await setup([aHr()]);
      const login = await service.login('test@hr.com', PASSWORD);

      const results = await Promise.allSettled([
        service.refresh(login.refreshToken),
        service.refresh(login.refreshToken),
      ]);

      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(SessionExpiredError);
      expect(tokens.all.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it('treats a lost revoke as reuse even when findByHash returned the row as it was before revocation', async () => {
      const { service, tokens } = await setup([aHr()]);
      const login = await service.login('test@hr.com', PASSWORD);
      const stale = await tokens.findByHash(sha256(login.refreshToken));
      await service.refresh(login.refreshToken); // the winner
      jest.spyOn(tokens, 'findByHash').mockResolvedValueOnce(stale);

      await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );

      expect(tokens.all.every((r) => r.revokedAt !== null)).toBe(true);
    });

    it.each([
      ['inactive', { status: 'INACTIVE' as const }],
      ['deleted', { deletedAt: '2026-10-01T00:00:00.000Z' }],
    ])(
      'revokes the presented token row before failing when the employee became %s',
      async (_label, change) => {
        const account = aHr();
        const { service, userRepo, tokens } = await setup([account]);
        const login = await service.login('test@hr.com', PASSWORD);
        userRepo.updateEmployee(account.id, change);

        await expect(
          service.refresh(login.refreshToken),
        ).rejects.toBeInstanceOf(SessionExpiredError);

        expect(
          tokens.all.find((r) => r.tokenHash === sha256(login.refreshToken))
            ?.revokedAt,
        ).toBeInstanceOf(Date);
      },
    );

    it('carries the original sessionStartedAt through rotation', async () => {
      const { service, tokens, advanceTo } = await setup([aHr()]);
      const login = await service.login('test@hr.com', PASSWORD);
      advanceTo(new Date(NOW.getTime() + 3 * DAY));

      const rotated = await service.refresh(login.refreshToken);

      const row = tokens.all.find(
        (r) => r.tokenHash === sha256(rotated.refreshToken),
      );
      expect(row?.sessionStartedAt).toEqual(NOW);
    });

    it('fails once 30 days have passed since sign-in even though the current token has not expired', async () => {
      const account = aHr();
      const { service, tokens, advanceTo } = await setup([account]);
      await tokens.create({
        userId: account.id,
        tokenHash: sha256('old-session'),
        expiresAt: new Date(NOW.getTime() + 3 * DAY),
        sessionStartedAt: new Date(NOW.getTime() - 31 * DAY),
      });
      advanceTo(NOW);

      await expect(service.refresh('old-session')).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
    });

    it('still refreshes a session that is 29 days old', async () => {
      const account = aHr();
      const { service, tokens } = await setup([account]);
      await tokens.create({
        userId: account.id,
        tokenHash: sha256('almost-old'),
        expiresAt: new Date(NOW.getTime() + 3 * DAY),
        sessionStartedAt: new Date(NOW.getTime() - 29 * DAY),
      });

      await expect(service.refresh('almost-old')).resolves.toBeDefined();
    });

    it('applies strict reuse: replaying a token rotated one second ago revokes every session', async () => {
      const { service, tokens, advanceTo } = await setup([aHr()]);
      const device = await service.login('test@hr.com', PASSWORD);
      const other = await service.login('test@hr.com', PASSWORD);
      await service.refresh(device.refreshToken);
      advanceTo(new Date(NOW.getTime() + 1000));

      await expect(service.refresh(device.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );

      expect(tokens.all.every((r) => r.revokedAt !== null)).toBe(true);
      await expect(service.refresh(other.refreshToken)).rejects.toBeInstanceOf(
        SessionExpiredError,
      );
    });

    it('picks up a changed employee type in the new access token', async () => {
      const account = aHr();
      const { service, userRepo, jwt } = await setup([account]);
      const login = await service.login('test@hr.com', PASSWORD);
      userRepo.updateEmployee(account.id, { type: 'EMPLOYEE' });

      const rotated = await service.refresh(login.refreshToken);

      expect(rotated.user.role).toBe('EMPLOYEE');
      expect(
        jwt.verify<{ role: string }>(rotated.accessToken, {
          ignoreExpiration: true,
        }).role,
      ).toBe('EMPLOYEE');
    });
  });

  describe('logout', () => {
    it('deletes only the current session', async () => {
      const { service, tokens } = await setup([aHr()]);
      const laptop = await service.login('test@hr.com', PASSWORD);
      const phone = await service.login('test@hr.com', PASSWORD);

      await service.logout(laptop.refreshToken);

      expect(tokens.all.map((r) => r.tokenHash)).toEqual([
        sha256(phone.refreshToken),
      ]);
      await expect(service.refresh(phone.refreshToken)).resolves.toBeDefined();
    });

    it('is idempotent for a missing or unknown token', async () => {
      const { service, tokens } = await setup([aHr()]);
      await service.login('test@hr.com', PASSWORD);

      await expect(service.logout(undefined)).resolves.toBeUndefined();
      await expect(service.logout('never-issued')).resolves.toBeUndefined();

      expect(tokens.all).toHaveLength(1);
    });
  });

  describe('me', () => {
    it('returns the current user without the password hash', async () => {
      const account = aHr();
      const { service } = await setup([account]);

      const user = await service.me(account.id);

      expect(user).toMatchObject({
        id: account.id,
        email: 'test@hr.com',
        role: 'HR',
      });
      expect(user.employee).toMatchObject({ id: account.employee.id });
      expect(JSON.stringify(user)).not.toContain('passwordHash');
    });
  });
});
