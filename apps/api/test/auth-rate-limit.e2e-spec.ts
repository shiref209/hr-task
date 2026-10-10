// Must precede any app import: appConfig is parsed when the module graph loads.
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '5';
process.env.LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE = '8';
process.env.LOGIN_RATE_LIMIT_PER_EMAIL = '1000';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { AuthModule } from '../src/auth/auth.module';
import { ScryptPasswordHasher } from '../src/auth/scrypt-password-hasher';
import type { UserAccount } from '../src/auth/users.repository';
import { configureApp } from '../src/configure-app';
import { httpAs, withAuthFakes } from './auth';
import { aUserAccount } from './fakes/in-memory-user-repository';

const PASSWORD = 'test@123';

// A fresh app per test: the throttler keeps its counters in the app instance.
describe('POST /auth/login rate limit (e2e)', () => {
  let app: INestApplication;
  let hr: UserAccount;
  let other: UserAccount;
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await new ScryptPasswordHasher({
      N: 16,
      r: 8,
      p: 1,
    }).hash(PASSWORD);
    hr = aUserAccount({
      email: 'test@hr.com',
      passwordHash,
      employee: { type: 'HR' },
    });
    other = aUserAccount({
      email: 'other@hr.com',
      passwordHash,
      employee: { type: 'EMPLOYEE' },
    });
  });
  beforeEach(async () => {
    const moduleRef = await withAuthFakes(
      Test.createTestingModule({
        imports: [
          LoggerModule.forRoot({ pinoHttp: { level: 'silent' } }),
          AuthModule,
        ],
      }),
      [hr, other],
    ).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterEach(async () => {
    await app.close();
  });

  const attempt = (email: string, password = 'wrong-password') =>
    httpAs(app).post('/auth/login').send({ email, password });

  it('returns 429 problem+json with Retry-After on the 6th attempt for the same IP and email', async () => {
    for (let i = 0; i < 5; i += 1) await attempt('test@hr.com').expect(401);

    const res = await attempt('test@hr.com');

    expect(res.status).toBe(429);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({
      type: '/problems/too-many-requests',
      status: 429,
    });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts successful logins too', async () => {
    for (let i = 0; i < 5; i += 1)
      await attempt('test@hr.com', PASSWORD).expect(200);

    await attempt('test@hr.com', PASSWORD).expect(429);
  });

  it('does not block a different email from the same IP', async () => {
    for (let i = 0; i < 5; i += 1) await attempt('test@hr.com').expect(401);
    await attempt('test@hr.com').expect(429);

    await attempt('other@hr.com', PASSWORD).expect(200);
  });

  it('treats email case and whitespace variants as the same key', async () => {
    for (let i = 0; i < 5; i += 1) await attempt('test@hr.com').expect(401);

    await attempt('  TEST@HR.COM ').expect(429);
  });

  it('returns 429 with Retry-After once one IP exceeds the per-IP limit across many emails', async () => {
    for (let i = 0; i < 8; i += 1) await attempt(`user${i}@hr.com`).expect(401);

    const res = await attempt('user8@hr.com');

    expect(res.status).toBe(429);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ type: '/problems/too-many-requests' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });
});
