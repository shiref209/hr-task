import { describe, expect, it } from 'vitest';
import { formatRate } from './format-rate';

describe('formatRate', () => {
  it.each([
    ['15.00', '15'],
    ['10.50', '10.5'],
    ['0.00', '0'],
    ['100.00', '100'],
    ['7.25', '7.25'],
    ['100', '100'],
  ])('%s -> %s', (input, expected) => {
    expect(formatRate(input)).toBe(expected);
  });
});
