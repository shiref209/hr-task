import type { IncomingMessage, ServerResponse } from 'node:http';
import { buildPinoHttpOptions } from './logger-options';

const build = (env: { NODE_ENV?: string; LOG_LEVEL?: string }) =>
  buildPinoHttpOptions({ LOG_LEVEL: 'info', ...env } as never);

const asReq = (url: string) => ({ url }) as IncomingMessage;
const asRes = (statusCode: number) => ({ statusCode }) as ServerResponse;

describe('buildPinoHttpOptions', () => {
  it('writes plain single-line JSON in production (no transport)', () => {
    expect(build({ NODE_ENV: 'production' }).transport).toBeUndefined();
  });

  it.each(['development', 'test', undefined])(
    'pretty-prints through pino-pretty when NODE_ENV is %s',
    (nodeEnv) => {
      const transport = build({ NODE_ENV: nodeEnv }).transport as {
        target: string;
      };

      expect(transport.target).toBe('pino-pretty');
    },
  );

  it('uses LOG_LEVEL as the level', () => {
    expect(build({ NODE_ENV: 'production', LOG_LEVEL: 'warn' }).level).toBe(
      'warn',
    );
  });

  describe('autoLogging.ignore', () => {
    const ignore = (url: string) =>
      (
        build({ NODE_ENV: 'production' }).autoLogging as {
          ignore: (req: IncomingMessage) => boolean;
        }
      ).ignore(asReq(url));

    it.each([
      '/health',
      '/docs',
      '/docs/',
      '/docs-json',
      '/docs/swagger-ui.css',
    ])('does not log %s', (url) => {
      expect(ignore(url)).toBe(true);
    });

    it('logs ordinary routes', () => {
      expect(ignore('/employees?search=a')).toBe(false);
    });
  });

  describe('customLogLevel', () => {
    const levelFor = (status: number) =>
      build({ NODE_ENV: 'production' }).customLogLevel?.(
        asReq('/x'),
        asRes(status),
        undefined,
      );

    it.each([
      [200, 'info'],
      [404, 'warn'],
      [500, 'error'],
    ])('logs status %i at %s', (status, level) => {
      expect(levelFor(status)).toBe(level);
    });
  });
});
