import { ScryptPasswordHasher } from './scrypt-password-hasher';

// Cheap cost so the suite stays fast; production defaults are not under test.
const hasher = new ScryptPasswordHasher({ N: 16, r: 8, p: 1 });

describe('ScryptPasswordHasher', () => {
  it('stores scrypt$N$r$p$salt$hash with the configured cost', async () => {
    const stored = await hasher.hash('test@123');

    const [scheme, n, r, p, salt, hash, ...rest] = stored.split('$');
    expect([scheme, n, r, p]).toEqual(['scrypt', '16', '8', '1']);
    expect(salt).not.toBe('');
    expect(hash).not.toBe('');
    expect(rest).toEqual([]);
  });

  it('never returns the plaintext', async () => {
    const stored = await hasher.hash('test@123');

    expect(stored).not.toContain('test@123');
  });

  it('uses a different salt for each hash of the same password', async () => {
    const first = (await hasher.hash('test@123')).split('$');
    const second = (await hasher.hash('test@123')).split('$');

    expect(first[4]).not.toBe(second[4]);
    expect(first[5]).not.toBe(second[5]);
  });

  it('verifies the right password', async () => {
    const stored = await hasher.hash('test@123');

    await expect(hasher.verify('test@123', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hasher.hash('test@123');

    await expect(hasher.verify('test@124', stored)).resolves.toBe(false);
  });

  it('verifies against the cost stored in the hash, not the current one', async () => {
    const stored = await new ScryptPasswordHasher({ N: 32, r: 8, p: 1 }).hash(
      'test@123',
    );

    await expect(hasher.verify('test@123', stored)).resolves.toBe(true);
  });

  it.each([
    ['an empty string', ''],
    ['plaintext', 'test@123'],
    ['too few parts', 'scrypt$16$8$1$salt'],
    ['an unknown scheme', 'bcrypt$16$8$1$c2FsdA$aGFzaA'],
    ['non-numeric cost', 'scrypt$x$8$1$c2FsdA$aGFzaA'],
    ['too many parts', 'scrypt$16$8$1$c2FsdA$aGFzaA$extra'],
  ])('returns false (does not throw) for %s', async (_label, stored) => {
    await expect(hasher.verify('test@123', stored)).resolves.toBe(false);
  });
});
