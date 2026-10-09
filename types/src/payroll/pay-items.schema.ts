import { z } from 'zod';
import { moneySchema } from './money.schema';

export const payItemSchema = z.strictObject({
  name: z
    .string({ error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name must be at most 60 characters'),
  amount: moneySchema,
});
export type PayItem = z.infer<typeof payItemSchema>;

export const payItemsSchema = z.strictObject({
  allowances: z.array(payItemSchema),
  deductions: z.array(payItemSchema),
});
export type PayItems = z.infer<typeof payItemsSchema>;
