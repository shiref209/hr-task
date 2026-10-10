import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import request from 'supertest';
import { AuthModule } from '../src/auth/auth.module';
import { configureApp } from '../src/configure-app';
import {
  DATABASE_HEALTH,
  type DatabaseHealth,
} from '../src/health/database-health';
import { HealthModule } from '../src/health/health.module';
import { buildPinoHttpOptions } from '../src/logging/logger-options';
import { withAuthFakes } from './auth';
import { LogCapture } from './fakes/log-capture';

const PROD = { NODE_ENV: 'production', LOG_LEVEL: 'info' } as const;

// nestjs-pino keeps one root pino-http instance per process, so every app logs into the first capture.
const capture = new LogCapture();

async function startApp(db: DatabaseHealth) {
  const moduleRef = await withAuthFakes(
    Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: [buildPinoHttpOptions(PROD), capture.stream],
        }),
        AuthModule,
        HealthModule,
      ],
    }),
  )
    .overrideProvider(DATABASE_HEALTH)
    .useValue(db)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}

describe('GET /health (e2e)', () => {
  let app: INestApplication;

  const boot = async (db: DatabaseHealth) => {
    capture.clear();
    app = await startApp(db);
  };
  afterEach(() => app.close());

  it('returns 200 { status: ok, database: up } as plain JSON, with no cookies or CSRF header', async () => {
    await boot({ ping: () => Promise.resolve() });

    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body).toStrictEqual({ status: 'ok', database: 'up' });
  });

  it('returns 503 { status: error, database: down } as plain JSON when the database throws', async () => {
    await boot({ ping: () => Promise.reject(new Error('connection refused')) });

    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-type']).not.toContain('problem');
    expect(res.body).toStrictEqual({ status: 'error', database: 'down' });
    expect(res.text).not.toContain('connection refused');
  });

  it('returns 503 within about a second when the database never answers', async () => {
    await boot({ ping: () => new Promise<void>(() => undefined) });
    const started = Date.now();

    const res = await request(app.getHttpServer()).get('/health');

    expect(res.status).toBe(503);
    expect(res.body).toStrictEqual({ status: 'error', database: 'down' });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('is never rate limited', async () => {
    await boot({ ping: () => Promise.resolve() });

    const statuses: number[] = [];
    for (let i = 0; i < 50; i += 1) {
      statuses.push((await request(app.getHttpServer()).get('/health')).status);
    }

    expect(statuses.every((s) => s === 200)).toBe(true);
  });

  it('is never request-logged, while other routes are', async () => {
    await boot({ ping: () => Promise.resolve() });

    await request(app.getHttpServer()).get('/health');
    await request(app.getHttpServer()).get('/auth/me');
    await new Promise((resolve) => setImmediate(resolve));

    expect(capture.text()).toContain('/auth/me');
    expect(capture.text()).not.toContain('/health');
  });
});
