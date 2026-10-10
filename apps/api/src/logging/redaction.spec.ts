import { createServer } from 'node:http';
import request from 'supertest';
import { pinoHttp } from 'pino-http';
import { LogCapture } from '../../test/fakes/log-capture';
import { buildPinoHttpOptions } from './logger-options';
import { redact, serializers } from './redaction';

const PROD = { NODE_ENV: 'production', LOG_LEVEL: 'info' } as const;

describe('serializers', () => {
  const rawReq = {
    method: 'GET',
    url: '/employees?search=Mona',
    headers: { cookie: 'access_token=SECRET', authorization: 'Bearer SECRET' },
    body: { password: 'SECRET' },
  };

  it('keeps only method and path for a request, dropping the query string', () => {
    expect(serializers.req(rawReq)).toStrictEqual({
      method: 'GET',
      path: '/employees',
    });
  });

  it('keeps only the status for a response', () => {
    const rawRes = {
      statusCode: 201,
      getHeaders: () => ({ 'set-cookie': ['refresh_token=SECRET'] }),
    };

    expect(serializers.res(rawRes)).toStrictEqual({ status: 201 });
  });
});

describe('redact', () => {
  it('removes cookie, set-cookie and authorization headers when present', () => {
    const capture = new LogCapture();
    const { logger } = pinoHttp({ redact, stream: capture.stream });

    logger.info({
      req: { headers: { cookie: 'c-SECRET', authorization: 'a-SECRET' } },
      res: { headers: { 'set-cookie': 's-SECRET' } },
    });

    expect(capture.text()).not.toContain('SECRET');
  });
});

describe('request log line', () => {
  async function logFor(
    send: (agent: ReturnType<typeof request>) => request.Test,
  ) {
    const capture = new LogCapture();
    const log = pinoHttp({
      ...buildPinoHttpOptions(PROD),
      stream: capture.stream,
    });
    const server = createServer((req, res) => {
      log(req, res);
      req.resume();
      req.on('end', () => res.end('{}'));
    });
    await send(request(server));
    await new Promise((resolve) => setImmediate(resolve));
    return capture;
  }

  it('contains no cookie, Authorization or body values', async () => {
    const capture = await logFor((agent) =>
      agent
        .post('/auth/login')
        .set('Cookie', 'access_token=COOKIE-SECRET')
        .set('Authorization', 'Bearer BEARER-SECRET')
        .send({ email: 'test@hr.com', password: 'BODY-SECRET' }),
    );

    expect(capture.lines()).toHaveLength(1);
    for (const secret of [
      'COOKIE-SECRET',
      'BEARER-SECRET',
      'BODY-SECRET',
      'test@hr.com',
    ]) {
      expect(capture.text()).not.toContain(secret);
    }
  });

  it('logs the path without the query string', async () => {
    const capture = await logFor((agent) =>
      agent.get('/employees?search=Mona'),
    );

    expect(capture.text()).toContain('/employees');
    expect(capture.text()).not.toContain('Mona');
    expect(capture.text()).not.toContain('search');
  });
});
