import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import { REFRESH_TOKEN_REPOSITORY } from '../src/auth/refresh-tokens.repository';
import { USER_REPOSITORY } from '../src/auth/users.repository';
import { InMemoryRefreshTokenRepository } from './fakes/in-memory-refresh-token-repository';
import {
  aUserAccount,
  InMemoryUserRepository,
} from './fakes/in-memory-user-repository';
import type { UserAccount } from '../src/auth/users.repository';

import './setup-env';

/**
 * The secret comes from `test/setup-env.ts` (jest `setupFiles` for unit and
 * e2e), so the app's `appConfig` and the tokens signed here always agree.
 */
export const TEST_JWT_SECRET = process.env.JWT_ACCESS_SECRET ?? '';

export const CSRF_HEADER = { 'X-Requested-With': 'hr-payroll' } as const;

type TestRole = 'HR' | 'EMPLOYEE';

/**
 * The HR user `authCookie('HR')` signs in as by default. `withAuthFakes` seeds
 * it, so HR-only routes (which re-read the user) work without per-suite setup.
 */
export const DEFAULT_HR_USER: UserAccount = aUserAccount({
  email: 'default-hr@example.com',
  employee: { type: 'HR', fullName: 'Default HR' },
});

/** A `Cookie` header value carrying a real, signed 15-minute access token. */
export function authCookie(
  role: TestRole,
  options: { employeeId?: string; userId?: string } = {},
): string {
  const token = new JwtService({ secret: TEST_JWT_SECRET }).sign(
    {
      sub:
        options.userId ?? (role === 'HR' ? DEFAULT_HR_USER.id : randomUUID()),
      employeeId:
        options.employeeId ??
        (role === 'HR' ? DEFAULT_HR_USER.employee.id : randomUUID()),
      role,
    },
    { expiresIn: '15m' },
  );
  return `access_token=${token}`;
}

/**
 * Supertest verbs that always send the CSRF header and, when given, the
 * cookie. `httpAs(app)` is an anonymous (but CSRF-compliant) client, so a
 * 401 can be told apart from a CSRF 403.
 */
export function httpAs(app: INestApplication, cookie?: string) {
  const call =
    (method: 'get' | 'post' | 'put' | 'patch' | 'delete') => (url: string) => {
      const req = request(app.getHttpServer())[method](url).set(CSRF_HEADER);
      return cookie ? req.set('Cookie', cookie) : req;
    };
  return {
    get: call('get'),
    post: call('post'),
    put: call('put'),
    patch: call('patch'),
    delete: call('delete'),
  };
}

/** Binds in-memory auth repositories so `AuthModule` never needs a database. */
export function withAuthFakes(
  builder: TestingModuleBuilder,
  users: UserAccount[] = [],
): TestingModuleBuilder {
  return builder
    .overrideProvider(USER_REPOSITORY)
    .useValue(new InMemoryUserRepository([DEFAULT_HR_USER, ...users]))
    .overrideProvider(REFRESH_TOKEN_REPOSITORY)
    .useValue(new InMemoryRefreshTokenRepository());
}
