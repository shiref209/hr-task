import { describe, expect, it } from 'vitest';
import { payItemSchema, payItemsSchema } from './pay-items.schema';

const item = (overrides: Record<string, unknown> = {}) => ({
  name: 'Transport',
  amount: '500.00',
  ...overrides,
});

const failedPaths = (input: unknown) => {
  const result = payItemsSchema.safeParse(input);
  return result.success
    ? null
    : result.error.issues.map((i) => i.path.join('.'));
};

describe('payItemSchema', () => {
  it('trims the name', () => {
    expect(payItemSchema.parse(item({ name: '  Transport ' })).name).toBe(
      'Transport',
    );
  });

  it('accepts names of 1 and 60 characters', () => {
    expect(payItemSchema.safeParse(item({ name: 'x' })).success).toBe(true);
    expect(
      payItemSchema.safeParse(item({ name: 'x'.repeat(60) })).success,
    ).toBe(true);
  });

  it('rejects a blank name and a name over 60 characters', () => {
    expect(payItemSchema.safeParse(item({ name: '  ' })).success).toBe(false);
    expect(
      payItemSchema.safeParse(item({ name: 'x'.repeat(61) })).success,
    ).toBe(false);
  });

  it.each(['0', '0.00', '-5', '10.001', 'abc', ''])(
    'rejects amount %j',
    (amount) => {
      expect(payItemSchema.safeParse(item({ amount })).success).toBe(false);
    },
  );

  it.each(['0.01', '500', '1234.5'])('accepts amount %s', (amount) => {
    expect(payItemSchema.safeParse(item({ amount })).success).toBe(true);
  });
});

describe('payItemsSchema', () => {
  it('accepts empty lists', () => {
    expect(
      payItemsSchema.safeParse({ allowances: [], deductions: [] }).success,
    ).toBe(true);
  });

  it('accepts 200 items per list: there is no count limit (edge case 11)', () => {
    const many = Array.from({ length: 200 }, (_, i) => item({ name: `N${i}` }));

    const result = payItemsSchema.safeParse({
      allowances: many,
      deductions: many,
    });

    expect(result.success).toBe(true);
  });

  it('allows duplicate names', () => {
    const loan = item({ name: 'Loan', amount: '100' });

    expect(
      payItemsSchema.safeParse({ allowances: [], deductions: [loan, loan] })
        .success,
    ).toBe(true);
  });

  it('reports invalid items at their index', () => {
    const paths = failedPaths({
      allowances: [item(), item({ amount: '0' })],
      deductions: [item({ name: '' })],
    });

    expect(paths).toContain('allowances.1.amount');
    expect(paths).toContain('deductions.0.name');
  });

  it('requires both lists', () => {
    expect(failedPaths({ allowances: [] })).toContain('deductions');
  });

  it('rejects unknown keys (strict)', () => {
    expect(
      payItemsSchema.safeParse({ allowances: [], deductions: [], x: 1 })
        .success,
    ).toBe(false);
  });
});
