import { describe, expect, it } from 'vitest';
import { payslipQuerySchema } from './payslip.schema';

describe('payslipQuerySchema', () => {
  it.each(['2026-01', '2026-12', '1999-06'])('accepts %s', (month) => {
    expect(payslipQuerySchema.parse({ month })).toEqual({ month });
  });

  it.each([
    '2026-13',
    '2026-00',
    '2026-3',
    '2026-03-01',
    '202603',
    'march',
    '',
  ])('rejects %j with an issue on month', (month) => {
    const result = payslipQuerySchema.safeParse({ month });

    expect(result.success).toBe(false);
    expect(
      !result.success && result.error.issues.map((i) => i.path.join('.')),
    ).toContain('month');
  });

  it('rejects a missing month', () => {
    expect(payslipQuerySchema.safeParse({}).success).toBe(false);
  });
});
