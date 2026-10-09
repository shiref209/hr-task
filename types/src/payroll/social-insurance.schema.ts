import { z } from 'zod';
import { moneySchema, rateSchema } from './money.schema';

export const socialInsuranceSchema = z.strictObject({
  rate: rateSchema,
  cap: moneySchema.nullable(),
});
export type SocialInsurance = z.infer<typeof socialInsuranceSchema>;
