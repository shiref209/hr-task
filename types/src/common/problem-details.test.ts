import { describe, expect, it } from 'vitest';
import { errorDetailsSchema } from '../index';

const base = {
  type: '/problems/not-found',
  title: 'Not Found',
  status: 404,
};

describe('errorDetailsSchema', () => {
  it('accepts a body without errors', () => {
    expect(errorDetailsSchema.safeParse(base).success).toBe(true);
  });

  it('accepts a body with field errors', () => {
    const body = {
      ...base,
      status: 400,
      errors: { email: ['Invalid email'] },
    };

    expect(errorDetailsSchema.safeParse(body).success).toBe(true);
  });

  it('rejects a body missing status', () => {
    const { status: _status, ...body } = base;

    expect(errorDetailsSchema.safeParse(body).success).toBe(false);
  });

  it('rejects a body missing title', () => {
    const { title: _title, ...body } = base;

    expect(errorDetailsSchema.safeParse(body).success).toBe(false);
  });
});
