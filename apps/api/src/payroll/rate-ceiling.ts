import Decimal from 'decimal.js';
import { BusinessRuleError } from '../common/errors/domain-errors';

// Above 100% tax + insurance could exceed the base salary and push net negative before any deduction.
export function assertRateCeiling(
  highestBracketRate: string,
  insuranceRate: string,
): void {
  if (new Decimal(highestBracketRate).plus(insuranceRate).gt(100))
    throw new BusinessRuleError(
      'The highest tax bracket rate plus the social insurance rate cannot exceed 100%.',
    );
}
