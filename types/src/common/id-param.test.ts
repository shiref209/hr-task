import { describe, expect, it } from 'vitest';
import { idParamSchema } from '../index';

describe('idParamSchema', () => {
  it('accepts a uuid', () => {
    const id = '3f2b8c1e-5d4a-4b7e-9c1a-2d3e4f5a6b7c';

    expect(idParamSchema.parse({ id })).toEqual({ id });
  });

  it('rejects a non-uuid id', () => {
    expect(idParamSchema.safeParse({ id: 'abc' }).success).toBe(false);
  });

  it('rejects a missing id', () => {
    expect(idParamSchema.safeParse({}).success).toBe(false);
  });
});
