import { describe, expect, it } from 'vitest';
import { normalizeSalary } from './salary';

describe('normalizeSalary', () => {
  it.each([
    ['12,500.5', '12500.50'],
    ['12500', '12500.00'],
    [' 7.1 ', '7.10'],
    ['12500.55', '12500.55'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeSalary(input)).toBe(expected);
  });

  it.each([
    ['12.345', '12.345'],
    ['abc', 'abc'],
    ['', ''],
    ['  abc  ', 'abc'],
    ['1,2,3.4.5', '1,2,3.4.5'],
  ])('returns invalid %j trimmed and unchanged (%j)', (input, expected) => {
    expect(normalizeSalary(input)).toBe(expected);
  });
});
