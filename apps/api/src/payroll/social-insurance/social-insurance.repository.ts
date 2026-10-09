import type { SocialInsurance } from '@hr/types';

export const SOCIAL_INSURANCE_REPOSITORY = Symbol(
  'SOCIAL_INSURANCE_REPOSITORY',
);

export interface SocialInsuranceRepository {
  get(): Promise<SocialInsurance>;
  save(settings: SocialInsurance): Promise<SocialInsurance>;
}
