import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { DatabaseHealth } from './database-health';

const TIMEOUT_MS = 1000;

function setup(db: DatabaseHealth) {
  const status = jest.fn();
  const res = { status } as unknown as Pick<Response, 'status'>;
  return { controller: new HealthController(db), res, status };
}

describe('HealthController', () => {
  afterEach(() => jest.useRealTimers());

  it('returns ok / up and leaves the status alone when the database answers', async () => {
    const { controller, res, status } = setup({
      ping: () => Promise.resolve(),
    });

    await expect(controller.check(res)).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(status).not.toHaveBeenCalled();
  });

  it('sets 503 and returns error / down, without details, when the database throws', async () => {
    const { controller, res, status } = setup({
      ping: () => Promise.reject(new Error('password authentication failed')),
    });

    const body = await controller.check(res);

    expect(status).toHaveBeenCalledWith(503);
    expect(body).toStrictEqual({ status: 'error', database: 'down' });
  });

  it('sets 503 after 1 second when the database never answers', async () => {
    jest.useFakeTimers();
    const { controller, res, status } = setup({
      ping: () => new Promise<void>(() => undefined),
    });

    const pending = controller.check(res);
    await jest.advanceTimersByTimeAsync(TIMEOUT_MS - 1);
    expect(status).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);

    await expect(pending).resolves.toStrictEqual({
      status: 'error',
      database: 'down',
    });
    expect(status).toHaveBeenCalledWith(503);
  });
});
