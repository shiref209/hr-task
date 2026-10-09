import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { PasswordHasher } from './password-hasher';

export interface ScryptCost {
  N: number;
  r: number;
  p: number;
}

const SALT_BYTES = 16;
const KEY_BYTES = 64;
const SCHEME = 'scrypt';

function derive(
  plain: string,
  salt: Buffer,
  keyLength: number,
  { N, r, p }: ScryptCost,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // Node's default maxmem (32 MiB) rejects costs above N=32768 at r=8; size it to the cost instead.
    scrypt(
      plain,
      salt,
      keyLength,
      { N, r, p, maxmem: 256 * N * r },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

// Stored as `scrypt$N$r$p$<salt b64>$<key b64>`; verify reads the cost back from the string
// so raising the default later doesn't lock out existing users.
export class ScryptPasswordHasher implements PasswordHasher {
  constructor(private readonly cost: ScryptCost = { N: 16384, r: 8, p: 1 }) {}

  async hash(plain: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await derive(plain, salt, KEY_BYTES, this.cost);
    const { N, r, p } = this.cost;
    return [
      SCHEME,
      N,
      r,
      p,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(plain: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, key, ...rest] = stored.split('$');
    if (scheme !== SCHEME || key === undefined || rest.length > 0) return false;
    const cost = { N: Number(n), r: Number(r), p: Number(p) };
    const expected = Buffer.from(key, 'base64');
    if (expected.length === 0) return false;
    try {
      const actual = await derive(
        plain,
        Buffer.from(salt, 'base64'),
        expected.length,
        cost,
      );
      return timingSafeEqual(actual, expected);
    } catch {
      // scrypt rejects invalid cost parameters; a malformed hash simply doesn't match.
      return false;
    }
  }
}
