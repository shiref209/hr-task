import { z } from 'zod';

export const payslipQuerySchema = z.object({
  month: z
    .string({ error: 'Enter a month as YYYY-MM' })
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Enter a month as YYYY-MM'),
});
export type PayslipQuery = z.infer<typeof payslipQuerySchema>;

const namedAmount = z.object({ name: z.string(), amount: z.string() });

export const payslipSchema = z.object({
  employee: z.object({ id: z.uuid(), fullName: z.string() }),
  month: z.string(),
  taxTable: z.object({ id: z.uuid(), name: z.string() }),
  baseSalary: z.string(),
  allowances: z.array(namedAmount),
  allowancesTotal: z.string(),
  gross: z.string(),
  tax: z.object({
    total: z.string(),
    effectiveRate: z.string(),
    brackets: z.array(
      z.object({
        from: z.string(),
        upTo: z.string().nullable(),
        rate: z.string(),
        taxable: z.string(),
        tax: z.string(),
      }),
    ),
  }),
  socialInsurance: z.object({
    rate: z.string(),
    cap: z.string().nullable(),
    amount: z.string(),
    capped: z.boolean(),
  }),
  deductions: z.array(
    z.object({ name: z.string(), requested: z.string(), applied: z.string() }),
  ),
  deductionsApplied: z.string(),
  deductionsUnapplied: z.string(),
  net: z.string(),
  warnings: z.array(z.string()),
});
export type Payslip = z.infer<typeof payslipSchema>;
