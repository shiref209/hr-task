import { Inject, Injectable } from '@nestjs/common';
import type { SocialInsurance } from '@hr/types';
import { assertRateCeiling } from '../rate-ceiling';
import {
  TAX_TABLE_REPOSITORY,
  type TaxTableRepository,
} from '../tax-tables/tax-tables.repository';
import {
  SOCIAL_INSURANCE_REPOSITORY,
  type SocialInsuranceRepository,
} from './social-insurance.repository';

@Injectable()
export class SocialInsuranceService {
  constructor(
    @Inject(SOCIAL_INSURANCE_REPOSITORY)
    private readonly socialInsurance: SocialInsuranceRepository,
    @Inject(TAX_TABLE_REPOSITORY)
    private readonly taxTables: TaxTableRepository,
  ) {}

  get(): Promise<SocialInsurance> {
    return this.socialInsurance.get();
  }

  async update(settings: SocialInsurance): Promise<SocialInsurance> {
    const highest = await this.taxTables.highestRate();
    if (highest !== null) assertRateCeiling(highest, settings.rate);
    return this.socialInsurance.save(settings);
  }
}
