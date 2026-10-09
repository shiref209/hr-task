import { describe, expect, it } from 'vitest';
import { loginSchema } from './login.schema';

describe('loginSchema', () => {
  it('trims and lowercases the email', () => {
    const result = loginSchema.parse({
      email: '  Test@HR.com  ',
      password: 'test@123',
    });

    expect(result.email).toBe('test@hr.com');
  });

  it('keeps the password exactly as typed', () => {
    const result = loginSchema.parse({
      email: 'test@hr.com',
      password: '  Spaces Kept  ',
    });

    expect(result.password).toBe('  Spaces Kept  ');
  });

  it('rejects a missing password', () => {
    const result = loginSchema.safeParse({ email: 'test@hr.com' });

    expect(result.success).toBe(false);
  });

  it('rejects an empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@hr.com',
      password: '',
    });

    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const result = loginSchema.safeParse({ password: 'test@123' });

    expect(result.success).toBe(false);
  });

  it('rejects a malformed email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'test@123',
    });

    expect(result.success).toBe(false);
  });
});
