import type { ExecutionContext } from '@nestjs/common';
import { loginThrottlers } from './login-throttlers';

const optionsOf = (name: string) => {
  const options = loginThrottlers.find((t) => t.name === name);
  if (!options) throw new Error(`no throttler named ${name}`);
  return options;
};
const contextOf = (req: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const trackerOf = (name: string) => {
  const { getTracker } = optionsOf(name);
  if (!getTracker) throw new Error(`no getTracker for ${name}`);
  return async (ip: string, email?: string) =>
    getTracker({ ip, body: email === undefined ? {} : { email } }, {
      switchToHttp: () => ({}),
    } as unknown as ExecutionContext);
};

describe('login throttler trackers', () => {
  describe('ip', () => {
    const key = trackerOf('ip');

    it('gives IPv6 addresses in the same /64 the same key', async () => {
      expect(await key('2001:db8::1')).toBe(await key('2001:db8::ffff'));
    });

    it('gives IPv6 addresses in different /64s different keys', async () => {
      expect(await key('2001:db8::1')).not.toBe(await key('2001:db8:0:1::1'));
    });

    it('treats an IPv4-mapped IPv6 address like the plain IPv4 address', async () => {
      expect(await key('::ffff:10.0.0.1')).toBe(await key('10.0.0.1'));
    });

    it('keeps different IPv4 addresses apart', async () => {
      expect(await key('10.0.0.1')).not.toBe(await key('10.0.0.2'));
    });
  });

  describe('ip-and-email', () => {
    const key = trackerOf('ip-and-email');

    it('gives the same /64 and the same email the same key', async () => {
      expect(await key('2001:db8::1', 'a@hr.com')).toBe(
        await key('2001:db8::ffff', 'a@hr.com'),
      );
    });

    it('gives the same /64 but different emails different keys', async () => {
      expect(await key('2001:db8::1', 'a@hr.com')).not.toBe(
        await key('2001:db8::1', 'b@hr.com'),
      );
    });

    it('normalises email case and whitespace', async () => {
      expect(await key('10.0.0.1', ' A@HR.com ')).toBe(
        await key('10.0.0.1', 'a@hr.com'),
      );
    });
  });

  describe('email (per account)', () => {
    // Lazy, so a missing throttler fails these tests instead of the whole suite.
    const key = (ip: string, email?: string) => trackerOf('email')(ip, email);

    it('has a 15-minute window', () => {
      expect(optionsOf('email').ttl).toBe(15 * 60_000);
    });

    it('keys by the normalised email regardless of IP', async () => {
      expect(await key('10.0.0.1', ' A@HR.com ')).toBe(
        await key('203.0.113.9', 'a@hr.com'),
      );
    });

    it('gives different emails different keys', async () => {
      expect(await key('10.0.0.1', 'a@hr.com')).not.toBe(
        await key('10.0.0.1', 'b@hr.com'),
      );
    });

    it.each([
      ['missing', {}],
      ['not a string', { email: 42 }],
      ['null', { email: null }],
    ])('is skipped when the email is %s', (_label, body) => {
      const { skipIf } = optionsOf('email');

      expect(skipIf?.(contextOf({ ip: '10.0.0.1', body }))).toBe(true);
    });

    it('is not skipped for a string email', () => {
      const { skipIf } = optionsOf('email');

      expect(
        skipIf?.(contextOf({ ip: '10.0.0.1', body: { email: 'a@hr.com' } })),
      ).toBe(false);
    });
  });
});
