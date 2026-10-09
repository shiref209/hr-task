import { z } from 'zod';

const MONEY_MESSAGE = 'Enter an amount greater than 0 with up to 2 decimals';
const RATE_MESSAGE = 'Enter a rate between 0 and 100 with up to 2 decimals';

// Max 10 integer digits + 2 decimals = NUMERIC(12,2); inputs are validated, never rounded.
export const moneyAmount = (text: z.ZodString) =>
  text
    .regex(/^\d{1,10}(\.\d{1,2})?$/, MONEY_MESSAGE)
    .refine((value) => /[1-9]/.test(value), MONEY_MESSAGE);

export const moneySchema = moneyAmount(z.string({ error: MONEY_MESSAGE }));

export const rateSchema = z
  .string({ error: RATE_MESSAGE })
  .regex(/^(100(\.0{1,2})?|\d{1,2}(\.\d{1,2})?)$/, RATE_MESSAGE);
