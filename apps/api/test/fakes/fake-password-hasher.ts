import type { PasswordHasher } from '../../src/auth/password-hasher';

/** Instant, deterministic stand-in for scrypt: `fake$<plain>`. */
export class FakePasswordHasher implements PasswordHasher {
  async hash(plain: string): Promise<string> {
    return `fake$${plain}`;
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    return stored === `fake$${plain}`;
  }
}
