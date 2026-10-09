import Decimal from 'decimal.js';
import type { SocialInsurance } from '@hr/types';
import type { SocialInsuranceRepository } from '../../src/payroll/social-insurance/social-insurance.repository';

export class InMemorySocialInsuranceRepository implements SocialInsuranceRepository {
  saved = 0;

  constructor(
    private settings: SocialInsurance = { rate: '11.00', cap: '2000.00' },
  ) {}

  async get(): Promise<SocialInsurance> {
    return format(this.settings);
  }

  async save(settings: SocialInsurance): Promise<SocialInsurance> {
    this.settings = format(settings);
    this.saved += 1;
    return format(this.settings);
  }
}

// Like Postgres NUMERIC(_,2): rate and cap always come back with 2 decimals.
const format = (s: SocialInsurance): SocialInsurance => ({
  rate: new Decimal(s.rate).toFixed(2),
  cap: s.cap === null ? null : new Decimal(s.cap).toFixed(2),
});
