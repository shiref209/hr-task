import { pinoHttp } from 'pino-http';
import { LogCapture } from '../../test/fakes/log-capture';
import { logAuthEvent } from './auth-events';

function setup() {
  const capture = new LogCapture();
  const { logger } = pinoHttp({ stream: capture.stream });
  return { logger, capture };
}

describe('logAuthEvent', () => {
  it('logs auth.login.succeeded at info with the user id only', () => {
    const { logger, capture } = setup();

    logAuthEvent(logger, 'auth.login.succeeded', { userId: 'u-1' });

    expect(capture.lines()).toEqual([
      expect.objectContaining({
        level: 30,
        msg: 'auth.login.succeeded',
        userId: 'u-1',
      }),
    ]);
  });

  it('logs auth.refresh.reuse_detected at warn with the user id', () => {
    const { logger, capture } = setup();

    logAuthEvent(logger, 'auth.refresh.reuse_detected', { userId: 'u-1' });

    expect(capture.lines()).toEqual([
      expect.objectContaining({
        level: 40,
        msg: 'auth.refresh.reuse_detected',
        userId: 'u-1',
      }),
    ]);
  });

  it('logs auth.logout with the user id', () => {
    const { logger, capture } = setup();

    logAuthEvent(logger, 'auth.logout', { userId: 'u-1' });

    expect(capture.lines()[0]).toMatchObject({
      msg: 'auth.logout',
      userId: 'u-1',
    });
  });

  it.each(['auth.login.failed', 'auth.login.rate_limited'] as const)(
    'logs %s with no fields beyond the pino defaults',
    (event) => {
      const { logger, capture } = setup();

      logAuthEvent(logger, event, {});

      const line = capture.lines()[0];
      expect(line.msg).toBe(event);
      expect(Object.keys(line).sort()).toEqual([
        'hostname',
        'level',
        'msg',
        'pid',
        'time',
      ]);
    },
  );
});
