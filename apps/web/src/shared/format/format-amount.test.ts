import { describe, expect, it } from 'vitest';
import { formatAmount } from './format-amount';

describe('formatAmount', () => {
  it.each([
    ['12500', '12,500.00'],
    ['0.5', '0.50'],
    ['0', '0.00'],
    ['1234.5', '1,234.50'],
    ['9999999999.99', '9,999,999,999.99'],
  ])('formats %s as %s', (input, expected) => {
    expect(formatAmount(input)).toBe(expected);
  });
});
