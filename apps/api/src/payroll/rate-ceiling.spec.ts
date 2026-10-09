import { BusinessRuleError } from '../common/errors/domain-errors';
import { assertRateCeiling } from './rate-ceiling';

describe('assertRateCeiling', () => {
  it.each([
    ['89', '11'],
    ['100', '0'],
    ['0', '100'],
    ['0', '0'],
    ['33.33', '66.67'],
    ['0.1', '99.9'],
  ])('accepts %s + %s (not above 100)', (bracket, insurance) => {
    expect(() => assertRateCeiling(bracket, insurance)).not.toThrow();
  });

  it.each([
    ['89.01', '11'],
    ['100', '0.01'],
    ['0.01', '100'],
    ['100', '100'],
  ])('rejects %s + %s (above 100)', (bracket, insurance) => {
    expect(() => assertRateCeiling(bracket, insurance)).toThrow(
      BusinessRuleError,
    );
  });
});
