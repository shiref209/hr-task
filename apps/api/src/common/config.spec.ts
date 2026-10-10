import { randomBytes } from 'node:crypto';
import { envSchema } from './config';

const SECRET = 'a'.repeat(32) + 'B'.repeat(32);
const PLACEHOLDER = 'replace-with-a-random-string-of-at-least-32-characters';
const parse = (env: Record<string, string | undefined>) =>
  envSchema.safeParse({ JWT_ACCESS_SECRET: SECRET, ...env });

describe('envSchema', () => {
  describe('JWT_ACCESS_SECRET', () => {
    it('accepts a random 64-character secret', () => {
      const secret = randomBytes(32).toString('hex');

      expect(parse({ JWT_ACCESS_SECRET: secret }).success).toBe(true);
    });

    it('rejects the placeholder shipped in .env.example', () => {
      expect(parse({ JWT_ACCESS_SECRET: PLACEHOLDER }).success).toBe(false);
    });

    it('rejects an empty value', () => {
      expect(parse({ JWT_ACCESS_SECRET: '' }).success).toBe(false);
    });
  });

  describe('SWAGGER_ENABLED', () => {
    it('defaults to false in production', () => {
      const result = parse({ NODE_ENV: 'production' });

      expect(result.success && result.data.SWAGGER_ENABLED).toBe(false);
    });

    it.each(['development', 'test', undefined])(
      'defaults to true when NODE_ENV is %s',
      (nodeEnv) => {
        const result = parse({ NODE_ENV: nodeEnv });

        expect(result.success && result.data.SWAGGER_ENABLED).toBe(true);
      },
    );

    it('lets an explicit true win in production', () => {
      const result = parse({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' });

      expect(result.success && result.data.SWAGGER_ENABLED).toBe(true);
    });

    it('lets an explicit false win outside production', () => {
      const result = parse({
        NODE_ENV: 'development',
        SWAGGER_ENABLED: 'false',
      });

      expect(result.success && result.data.SWAGGER_ENABLED).toBe(false);
    });
  });

  describe('WEB_ORIGIN', () => {
    it('rejects a value that is not a URL', () => {
      expect(parse({ WEB_ORIGIN: 'not a url' }).success).toBe(false);
    });

    it('accepts a valid origin', () => {
      expect(parse({ WEB_ORIGIN: 'https://hr.example.com' }).success).toBe(
        true,
      );
    });

    it('defaults to the local web dev server', () => {
      const result = parse({});

      expect(result.success && result.data.WEB_ORIGIN).toBe(
        'http://localhost:5173',
      );
    });
  });

  describe('LOGIN_RATE_LIMIT_PER_MINUTE', () => {
    it('defaults to 5', () => {
      const result = parse({});

      expect(result.success && result.data.LOGIN_RATE_LIMIT_PER_MINUTE).toBe(5);
    });

    it('accepts a positive integer', () => {
      const result = parse({ LOGIN_RATE_LIMIT_PER_MINUTE: '1000' });

      expect(result.success && result.data.LOGIN_RATE_LIMIT_PER_MINUTE).toBe(
        1000,
      );
    });

    it.each(['0', '-3', 'abc', '2.5', ''])('rejects %j', (value) => {
      expect(parse({ LOGIN_RATE_LIMIT_PER_MINUTE: value }).success).toBe(false);
    });
  });

  describe('LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE', () => {
    it('defaults to 20', () => {
      const result = parse({});

      expect(
        result.success && result.data.LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE,
      ).toBe(20);
    });

    it('accepts a positive integer', () => {
      const result = parse({ LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE: '1000' });

      expect(
        result.success && result.data.LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE,
      ).toBe(1000);
    });

    it.each(['0', '-3', 'abc', '2.5', ''])('rejects %j', (value) => {
      expect(parse({ LOGIN_RATE_LIMIT_PER_IP_PER_MINUTE: value }).success).toBe(
        false,
      );
    });
  });

  describe('LOGIN_RATE_LIMIT_PER_EMAIL', () => {
    it('defaults to 30', () => {
      const result = parse({});

      expect(result.success && result.data.LOGIN_RATE_LIMIT_PER_EMAIL).toBe(30);
    });

    it('accepts a positive integer', () => {
      const result = parse({ LOGIN_RATE_LIMIT_PER_EMAIL: '1000' });

      expect(result.success && result.data.LOGIN_RATE_LIMIT_PER_EMAIL).toBe(
        1000,
      );
    });

    it.each(['0', '-3', 'abc', '2.5', ''])('rejects %j', (value) => {
      expect(parse({ LOGIN_RATE_LIMIT_PER_EMAIL: value }).success).toBe(false);
    });
  });

  describe('LOG_LEVEL', () => {
    it('defaults to info', () => {
      const result = parse({});

      expect(result.success && result.data.LOG_LEVEL).toBe('info');
    });

    it.each(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])(
      'accepts %s',
      (level) => {
        const result = parse({ LOG_LEVEL: level });

        expect(result.success && result.data.LOG_LEVEL).toBe(level);
      },
    );

    it.each(['verbose', '', 'INFO'])('rejects %j', (level) => {
      expect(parse({ LOG_LEVEL: level }).success).toBe(false);
    });
  });
});
