// Must precede any app import: appConfig is parsed when the module graph loads.
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '1000';

import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { ScryptPasswordHasher } from '../src/auth/scrypt-password-hasher';
import type { UserAccount } from '../src/auth/users.repository';
import { CLOCK } from '../src/common/clock';
import { configureApp } from '../src/configure-app';
import { authCookie, httpAs, TEST_JWT_SECRET, withAuthFakes } from './auth';
import {
  aUserAccount,
  InMemoryUserRepository,
} from './fakes/in-memory-user-repository';
import { USER_REPOSITORY } from '../src/auth/users.repository';

const PASSWORD = 'test@123';
const PROBLEM = 'application/problem+json';

/** Raw `Set-Cookie` header lines of a response. */
const setCookies = (res: request.Response): string[] => {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(header) ? header : header ? [header] : [];
};
const cookieLine = (res: request.Response, name: string): string =>
  setCookies(res).find((c) => c.startsWith(`${name}=`)) ?? '';
const cookieValue = (res: request.Response, name: string): string =>
  cookieLine(res, name)
    .split(';')[0]
    .slice(name.length + 1);
const asCookieHeader = (res: request.Response): string =>
  `access_token=${cookieValue(res, 'access_token')}; refresh_token=${cookieValue(res, 'refresh_token')}`;
const refreshOnly = (res: request.Response): string =>
  `refresh_token=${cookieValue(res, 'refresh_token')}`;

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let hr: UserAccount;
  let inactive: UserAccount;
  let employee: UserAccount;
  let fading: UserAccount;
  let userRepo: InMemoryUserRepository;
  let current = new Date();

  beforeAll(async () => {
    // Cheap scrypt cost; verify() reads the cost back out of the stored hash.
    const passwordHash = await new ScryptPasswordHasher({
      N: 16,
      r: 8,
      p: 1,
    }).hash(PASSWORD);
    hr = aUserAccount({
      email: 'test@hr.com',
      passwordHash,
      employee: { type: 'HR', fullName: 'Hana HR' },
    });
    employee = aUserAccount({
      email: 'test@employee.com',
      passwordHash,
      employee: { type: 'EMPLOYEE', fullName: 'Eli Employee' },
    });
    fading = aUserAccount({
      email: 'fading@hr.com',
      passwordHash,
      employee: { type: 'EMPLOYEE' },
    });
    inactive = aUserAccount({
      email: 'gone@hr.com',
      passwordHash,
      employee: { status: 'INACTIVE' },
    });
    const moduleRef = await withAuthFakes(
      Test.createTestingModule({ imports: [AuthModule] }),
      [hr, employee, inactive, fading],
    )
      .overrideProvider(CLOCK)
      .useValue({ now: () => new Date(current) })
      .compile();
    userRepo = moduleRef.get<InMemoryUserRepository>(USER_REPOSITORY);
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  const anonymous = () => httpAs(app);
  const login = (email = 'test@hr.com', password = PASSWORD) =>
    anonymous().post('/auth/login').send({ email, password });

  describe('POST /auth/login', () => {
    it('returns 200 with the user and no secrets in the body', async () => {
      const res = await login().expect(200);

      expect(res.body.data.user).toMatchObject({
        id: hr.id,
        email: 'test@hr.com',
        role: 'HR',
        employee: { id: hr.employee.id, fullName: 'Hana HR' },
      });
      expect(res.text).not.toMatch(/passwordHash|access_token|refresh_token/);
      expect(res.text).not.toContain(cookieValue(res, 'refresh_token'));
    });

    it('sets an httpOnly SameSite=Strict access cookie scoped to /', async () => {
      const res = await login();

      const line = cookieLine(res, 'access_token');
      expect(line).toMatch(/^access_token=[^;]+/);
      expect(line).toMatch(/;\s*Path=\/(;|$)/);
      expect(line).toMatch(/;\s*HttpOnly/i);
      expect(line).toMatch(/;\s*SameSite=Strict/i);
      expect(line).not.toMatch(/;\s*Secure/i);
    });

    it('sets an httpOnly SameSite=Strict refresh cookie scoped to /auth', async () => {
      const res = await login();

      const line = cookieLine(res, 'refresh_token');
      expect(line).toMatch(/^refresh_token=[^;]+/);
      expect(line).toMatch(/;\s*Path=\/auth(;|$)/);
      expect(line).toMatch(/;\s*HttpOnly/i);
      expect(line).toMatch(/;\s*SameSite=Strict/i);
    });

    it('issues a signed 15-minute access token', async () => {
      const res = await login();

      const claims = new JwtService({ secret: TEST_JWT_SECRET }).verify<{
        sub: string;
        employeeId: string;
        role: string;
        iat: number;
        exp: number;
      }>(cookieValue(res, 'access_token'));
      expect(claims).toMatchObject({
        sub: hr.id,
        employeeId: hr.employee.id,
        role: 'HR',
      });
      expect(claims.exp - claims.iat).toBe(900);
    });

    it('trims and ignores the case of the email (edge case 2)', async () => {
      const res = await login('  TEST@HR.com ').expect(200);

      expect(res.body.data.user.email).toBe('test@hr.com');
    });

    it('lets an EMPLOYEE sign in with role EMPLOYEE', async () => {
      const res = await login('test@employee.com').expect(200);

      expect(res.body.data.user.role).toBe('EMPLOYEE');
    });

    it('returns the same 401 for a wrong password and an unknown email (edge case 1)', async () => {
      const wrongPassword = await login('test@hr.com', 'nope').expect(401);
      const unknownEmail = await login('ghost@hr.com', 'nope').expect(401);

      expect(wrongPassword.headers['content-type']).toContain(PROBLEM);
      expect(wrongPassword.body).toMatchObject({
        status: 401,
        detail: 'Invalid email or password',
      });
      expect(unknownEmail.body).toEqual(wrongPassword.body);
      expect(setCookies(wrongPassword)).toEqual([]);
    });

    it('returns that same 401 for an INACTIVE employee', async () => {
      const res = await login('gone@hr.com').expect(401);

      expect(res.body.detail).toBe('Invalid email or password');
    });

    it('returns 400 with field errors when the password is missing', async () => {
      const res = await anonymous()
        .post('/auth/login')
        .send({ email: 'test@hr.com' })
        .expect(400);

      expect(Object.keys(res.body.errors)).toContain('password');
    });

    it('returns 403 without the X-Requested-With header', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@hr.com', password: PASSWORD })
        .expect(403);

      expect(res.headers['content-type']).toContain(PROBLEM);
      expect(res.body.status).toBe(403);
      expect(setCookies(res)).toEqual([]);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the signed-in user with an employee summary and no pay fields', async () => {
      const session = await login('test@employee.com');

      const res = await httpAs(app, asCookieHeader(session))
        .get('/auth/me')
        .expect(200);

      expect(res.body.data.user).toMatchObject({
        id: employee.id,
        email: 'test@employee.com',
        role: 'EMPLOYEE',
        employee: { id: employee.employee.id, fullName: 'Eli Employee' },
      });
      expect(res.text).not.toMatch(/baseSalary|taxTable|passwordHash/);
    });

    it('returns 401 problem+json without a cookie', async () => {
      const res = await anonymous().get('/auth/me').expect(401);

      expect(res.headers['content-type']).toContain(PROBLEM);
      expect(res.body.status).toBe(401);
    });

    it('returns 401 for a token signed with another secret', async () => {
      const forged = new JwtService({ secret: 'x'.repeat(40) }).sign(
        { sub: hr.id, employeeId: hr.employee.id, role: 'HR' },
        { expiresIn: '15m' },
      );

      await httpAs(app, `access_token=${forged}`).get('/auth/me').expect(401);
    });

    it('returns 401 for an expired token (edge case 4)', async () => {
      const expired = new JwtService({ secret: TEST_JWT_SECRET }).sign({
        sub: hr.id,
        employeeId: hr.employee.id,
        role: 'HR',
        exp: Math.floor(Date.now() / 1000) - 60,
      });

      await httpAs(app, `access_token=${expired}`).get('/auth/me').expect(401);
    });

    it('accepts a token minted by the test helper', async () => {
      const cookie = authCookie('HR', { userId: hr.id });

      await httpAs(app, cookie).get('/auth/me').expect(200);
    });
  });

  describe('POST /auth/refresh', () => {
    it('rotates both cookies and returns the user', async () => {
      const first = await login();

      const res = await httpAs(app, refreshOnly(first))
        .post('/auth/refresh')
        .expect(200);

      expect(res.body.data.user).toMatchObject({ id: hr.id, role: 'HR' });
      expect(cookieValue(res, 'refresh_token')).not.toBe(
        cookieValue(first, 'refresh_token'),
      );
      expect(cookieLine(res, 'refresh_token')).toMatch(/Path=\/auth/);
      expect(cookieLine(res, 'refresh_token')).toMatch(/HttpOnly/i);
      expect(cookieLine(res, 'access_token')).toMatch(/Path=\/(;|$)/);
      expect(cookieValue(res, 'access_token')).not.toBe('');
    });

    it('rejects the old refresh token after rotation and revokes the whole family (edge case 9)', async () => {
      const first = await login();
      const second = await httpAs(app, refreshOnly(first))
        .post('/auth/refresh')
        .expect(200);

      await httpAs(app, refreshOnly(first)).post('/auth/refresh').expect(401);

      await httpAs(app, refreshOnly(second)).post('/auth/refresh').expect(401);
    });

    it('returns 401 without a refresh cookie', async () => {
      const res = await anonymous().post('/auth/refresh').expect(401);

      expect(res.headers['content-type']).toContain(PROBLEM);
    });

    it('returns 401 for an unknown refresh token', async () => {
      await httpAs(app, 'refresh_token=never-issued')
        .post('/auth/refresh')
        .expect(401);
    });

    describe('on any failure', () => {
      const expectCookiesCleared = (res: request.Response) => {
        const access = cookieLine(res, 'access_token');
        const refresh = cookieLine(res, 'refresh_token');
        expect(access).toMatch(/^access_token=;/);
        expect(access).toMatch(/Path=\/(;|$)/);
        expect(access).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(access).toMatch(/HttpOnly/i);
        expect(access).toMatch(/SameSite=Strict/i);
        expect(refresh).toMatch(/^refresh_token=;/);
        expect(refresh).toMatch(/Path=\/auth(;|$)/);
        expect(refresh).toMatch(/Expires=Thu, 01 Jan 1970/);
        expect(refresh).toMatch(/HttpOnly/i);
        expect(refresh).toMatch(/SameSite=Strict/i);
      };

      it('clears both cookies for an unknown token', async () => {
        const res = await httpAs(app, 'refresh_token=never-issued')
          .post('/auth/refresh')
          .expect(401);

        expectCookiesCleared(res);
      });

      it('clears both cookies when no refresh cookie is sent', async () => {
        const res = await anonymous().post('/auth/refresh').expect(401);

        expectCookiesCleared(res);
      });

      it('clears both cookies for a revoked (rotated) token', async () => {
        const first = await login();
        await httpAs(app, refreshOnly(first)).post('/auth/refresh').expect(200);

        const res = await httpAs(app, refreshOnly(first))
          .post('/auth/refresh')
          .expect(401);

        expectCookiesCleared(res);
      });

      it('clears both cookies for an expired token', async () => {
        const session = await login();
        const start = current;
        current = new Date(start.getTime() + 8 * 24 * 60 * 60 * 1000);
        try {
          const res = await httpAs(app, refreshOnly(session))
            .post('/auth/refresh')
            .expect(401);

          expectCookiesCleared(res);
        } finally {
          current = start;
        }
      });

      it('clears both cookies when the user became inactive', async () => {
        const session = await login('fading@hr.com');
        userRepo.updateEmployee(fading.id, { status: 'INACTIVE' });

        const res = await httpAs(app, refreshOnly(session))
          .post('/auth/refresh')
          .expect(401);

        expectCookiesCleared(res);
      });
    });

    it('ends the session 30 days after sign-in even if the current token has not expired, and clears cookies', async () => {
      const day = 24 * 60 * 60 * 1000;
      const start = current;
      try {
        let session = await login();
        for (let i = 0; i < 4; i += 1) {
          current = new Date(current.getTime() + 6 * day);
          session = await httpAs(app, refreshOnly(session))
            .post('/auth/refresh')
            .expect(200);
        }
        // Day 24 token is valid until day 31; sign-in was 30 days + 1 hour ago.
        current = new Date(start.getTime() + 30 * day + 60 * 60 * 1000);

        const res = await httpAs(app, refreshOnly(session))
          .post('/auth/refresh')
          .expect(401);

        expect(cookieLine(res, 'access_token')).toMatch(/^access_token=;/);
        expect(cookieLine(res, 'refresh_token')).toMatch(/^refresh_token=;/);
      } finally {
        current = start;
      }
    });

    it('returns 403 without the X-Requested-With header', async () => {
      const session = await login();

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .set('Cookie', refreshOnly(session))
        .expect(403);
    });
  });

  describe('POST /auth/logout', () => {
    it('returns 204 and clears both cookies', async () => {
      const session = await login();

      const res = await httpAs(app, asCookieHeader(session))
        .post('/auth/logout')
        .expect(204);

      expect(res.text).toBe('');
      const access = cookieLine(res, 'access_token');
      const refresh = cookieLine(res, 'refresh_token');
      expect(access).toMatch(/^access_token=;/);
      expect(access).toMatch(/Path=\/(;|$)/);
      expect(access).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(refresh).toMatch(/^refresh_token=;/);
      expect(refresh).toMatch(/Path=\/auth(;|$)/);
      expect(refresh).toMatch(/Expires=Thu, 01 Jan 1970/);
    });

    it('invalidates the refresh token of the current session', async () => {
      const session = await login();
      await httpAs(app, refreshOnly(session)).post('/auth/logout').expect(204);

      await httpAs(app, refreshOnly(session)).post('/auth/refresh').expect(401);
    });

    it('keeps other devices signed in (edge case 8)', async () => {
      const laptop = await login();
      const phone = await login();

      await httpAs(app, refreshOnly(laptop)).post('/auth/logout').expect(204);

      await httpAs(app, refreshOnly(phone)).post('/auth/refresh').expect(200);
    });

    it('is idempotent without any cookie', async () => {
      await anonymous().post('/auth/logout').expect(204);
    });

    it('returns 403 without the X-Requested-With header', async () => {
      await request(app.getHttpServer()).post('/auth/logout').expect(403);
    });
  });
});
