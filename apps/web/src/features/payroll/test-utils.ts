import type { SocialInsurance, TaxTable } from '@hr/types';

/** Builds a tax table as the API returns it (rates and limits are 2-decimal strings); `n` makes the id a unique UUID. */
export function aTaxTable(n: number, overrides: Partial<TaxTable> = {}): TaxTable {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    name: `Table ${n}`,
    isDefault: false,
    brackets: [{ upTo: null, rate: '10.00' }],
    employeeCount: 0,
    ...overrides,
  };
}

export function aSocialInsurance(overrides: Partial<SocialInsurance> = {}): SocialInsurance {
  return { rate: '11.00', cap: '2000.00', ...overrides };
}
