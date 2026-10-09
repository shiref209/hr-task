import { describe, expect, it } from 'vitest';
import { socialInsuranceSchema } from './social-insurance.schema';

const parse = (input: unknown) => socialInsuranceSchema.safeParse(input);
const failedPaths = (input: unknown) => {
  const result = parse(input);
  return result.success
    ? null
    : result.error.issues.map((i) => i.path.join('.'));
};

describe('socialInsuranceSchema', () => {
  it('accepts a rate with a cap', () => {
    expect(parse({ rate: '11', cap: '2000.00' }).success).toBe(true);
  });

  it('accepts a null cap (no cap)', () => {
    expect(parse({ rate: '11', cap: null }).success).toBe(true);
  });

  it('accepts rate 0 and rate 100', () => {
    expect(parse({ rate: '0', cap: null }).success).toBe(true);
    expect(parse({ rate: '100', cap: null }).success).toBe(true);
  });

  it.each(['100.01', '-1', '11.123', 'abc'])('rejects rate %j', (rate) => {
    expect(failedPaths({ rate, cap: null })).toContain('rate');
  });

  it.each(['0', '-10', '10.001'])('rejects cap %j', (cap) => {
    expect(failedPaths({ rate: '11', cap })).toContain('cap');
  });

  it('requires the cap key (null means no cap)', () => {
    expect(failedPaths({ rate: '11' })).toContain('cap');
  });

  it('rejects unknown keys (strict)', () => {
    expect(parse({ rate: '11', cap: null, extra: 1 }).success).toBe(false);
  });
});
