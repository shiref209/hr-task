// Must precede any app import: appConfig is parsed when the module graph loads.
// Per-IP and per-IP+email are set high so only the per-account limit can fire.
process.env.LOGIN_RATE_LIMIT_PER_MINUTE = '1000';
process.env.LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE = '1000';
process.env.LOGIN_RATE_LIMIT_PER_EMAIL = '3';

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
describe('POST /auth/login per-account rate limit (e2e)', () => {
  let app: INestApplication;
  let hr: UserAccount;

  beforeAll(async () => {
    const passwordHash = await new ScryptPasswordHasher({
      N: 16,
      r: 8,
      p: 1,
    }).hash(PASSWORD);
    hr = aUserAccount({
      email: 'test@hr.com',
      passwordHash,
      employee: { type: 'HR' },
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
      [hr],
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

  it('returns 429 problem+json with Retry-After on the 4th attempt for one email', async () => {
    for (let i = 0; i < 3; i += 1) await attempt('test@hr.com').expect(401);

    const res = await attempt('test@hr.com');

    expect(res.status).toBe(429);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body).toMatchObject({ type: '/problems/too-many-requests' });
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('does not block a different email', async () => {
    for (let i = 0; i < 4; i += 1) await attempt('test@hr.com');

    await attempt('other@hr.com').expect(401);
  });

  it('counts email case and whitespace variants against the same account', async () => {
    for (let i = 0; i < 3; i += 1) await attempt('test@hr.com').expect(401);

    await attempt('  TEST@HR.COM ').expect(429);
  });
});
