import { randomUUID } from 'node:crypto';
import type { PayItems, SocialInsurance, TaxTable } from '@hr/types';

/** Example brackets from the spec: <=10,000 @ 0% / <=20,000 @ 10% / above @ 15%. */
export const STANDARD_BRACKETS: TaxTable['brackets'] = [
  { upTo: '10000.00', rate: '0.00' },
  { upTo: '20000.00', rate: '10.00' },
  { upTo: null, rate: '15.00' },
];

export function aTaxTable(overrides: Partial<TaxTable> = {}): TaxTable {
  return {
    id: randomUUID(),
    name: 'Standard',
    isDefault: false,
    brackets: STANDARD_BRACKETS.map((b) => ({ ...b })),
    employeeCount: 0,
    ...overrides,
  };
}

export function aDefaultTaxTable(overrides: Partial<TaxTable> = {}): TaxTable {
  return aTaxTable({ isDefault: true, ...overrides });
}

export function aSocialInsurance(
  overrides: Partial<SocialInsurance> = {},
): SocialInsurance {
  return { rate: '11.00', cap: '2000.00', ...overrides };
}

export function somePayItems(overrides: Partial<PayItems> = {}): PayItems {
  return { allowances: [], deductions: [], ...overrides };
}
