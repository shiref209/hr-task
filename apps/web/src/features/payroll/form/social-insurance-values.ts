import type { SocialInsurance } from '@hr/types';
import { formatAmount } from '@hr/types';
import { normalizeSalary } from '../../../shared/forms/salary';

export interface SocialInsuranceFormValues {
  rate: string;
  capped: boolean;
  cap: string;
}

export function toFormValues({ rate, cap }: SocialInsurance): SocialInsuranceFormValues {
  return { rate: normalizeSalary(rate), capped: cap !== null, cap: cap === null ? '' : formatAmount(cap) };
}

export function toInput({ rate, capped, cap }: SocialInsuranceFormValues): SocialInsurance {
  return { rate: normalizeSalary(rate), cap: capped ? normalizeSalary(cap) : null };
}
