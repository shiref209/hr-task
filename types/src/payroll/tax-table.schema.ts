import { z } from 'zod';
import { moneySchema, rateSchema } from './money.schema';

export const taxBracketInputSchema = z.strictObject({
  upTo: moneySchema.nullable(),
  rate: rateSchema,
});

const isMoney = (value: string | null): value is string =>
  value !== null && moneySchema.safeParse(value).success;

// Integer cents keep the comparison exact without floating point.
const toCents = (money: string): bigint => {
  const [whole, fraction = ''] = money.split('.');
  return BigInt(whole + fraction.padEnd(2, '0'));
};

// A rejecting catchall instead of strictObject: it reports an unknown key at its own path (e.g. `isDefault`).
export const taxTableInputSchema = z
  .object({
    name: z
      .string({ error: 'Name is required' })
      .trim()
      .min(1, 'Name is required')
      .max(60, 'Name must be at most 60 characters'),
    brackets: z
      .array(taxBracketInputSchema)
      .min(1, 'Add at least one bracket'),
  })
  .catchall(z.unknown().refine(() => false, 'Unknown field'))
  .superRefine(({ brackets }, ctx) => {
    const reject = (index: number, message: string) =>
      ctx.addIssue({
        code: 'custom',
        path: ['brackets', index, 'upTo'],
        message,
      });
    const last = brackets.length - 1;
    brackets.forEach(({ upTo }, index) => {
      if (upTo === null && index < last)
        return reject(index, 'Only the last bracket can have no upper limit');
      if (upTo !== null && index === last)
        return reject(index, 'The last bracket must have no upper limit');
      const previous = brackets[index - 1]?.upTo ?? null;
      if (
        isMoney(upTo) &&
        isMoney(previous) &&
        toCents(upTo) <= toCents(previous)
      )
        reject(index, 'Must be greater than the previous upper limit');
    });
  });
export type TaxTableInput = z.output<typeof taxTableInputSchema>;

export const taxTableSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  isDefault: z.boolean(),
  brackets: z.array(z.object({ upTo: z.string().nullable(), rate: z.string() })),
  employeeCount: z.number().int(),
});
export type TaxTable = z.infer<typeof taxTableSchema>;
