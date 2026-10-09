import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination';

export const employeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE'], {
  error: 'Select a status',
});
export const employeeTypeSchema = z.enum(['HR', 'EMPLOYEE'], {
  error: 'Select a type',
});
export type EmployeeStatus = z.infer<typeof employeeStatusSchema>;
export type EmployeeType = z.infer<typeof employeeTypeSchema>;

export const departmentSchema = z.object({
  id: z.uuid(),
  name: z.string(),
});
export type Department = z.infer<typeof departmentSchema>;

export const employeeSchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  jobTitle: z.string(),
  department: departmentSchema,
  hireDate: z.string(),
  baseSalary: z.string(),
  status: employeeStatusSchema,
  type: employeeTypeSchema,
  profileImageUrl: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Employee = z.infer<typeof employeeSchema>;

const requiredText = (label: string) =>
  z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(100, `${label} must be at most 100 characters`);

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(
    z
      .email('Enter a valid email address')
      .max(254, 'Email must be at most 254 characters'),
  );

const E164 = /^\+[1-9]\d{7,14}$/;
const phone = z
  .string({
    error: 'Enter a phone number in international format, e.g. +201001234567',
  })
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .refine(
    (value) => value === '' || E164.test(value),
    'Enter a phone number in international format, e.g. +201001234567',
  )
  .transform((value) => value || null)
  .nullable();

const SALARY_MESSAGE = 'Enter an amount greater than 0 with up to 2 decimals';

// Max 10 integer digits + 2 decimals = NUMERIC(12,2); inputs are validated, never rounded.
const baseSalary = z
  .string({
    error: (issue) =>
      issue.input === undefined
        ? 'Salary is required'
        : 'Salary must be sent as a text amount, e.g. "5000.00"',
  })
  .regex(/^\d{1,10}(\.\d{1,2})?$/, SALARY_MESSAGE)
  .refine((value) => /[1-9]/.test(value), SALARY_MESSAGE);

const fields = (today: string) => ({
  fullName: requiredText('Full name'),
  email,
  phone,
  jobTitle: requiredText('Job title'),
  departmentId: z.uuid({ error: 'Select a department' }),
  hireDate: z.iso
    .date({ error: 'Enter a valid date' })
    .refine((date) => date <= today, "Hire date can't be in the future")
    .describe('Must not be after today in the API time zone (APP_TIMEZONE)'),
  baseSalary,
  status: employeeStatusSchema,
  type: employeeTypeSchema,
});

export function buildCreateEmployeeSchema({ today }: { today: string }) {
  const shape = fields(today);
  return z.strictObject({
    ...shape,
    phone: shape.phone.default(null),
    status: shape.status.default('ACTIVE'),
    type: shape.type.default('EMPLOYEE'),
  });
}
export type CreateEmployeeInput = z.output<
  ReturnType<typeof buildCreateEmployeeSchema>
>;

export function buildUpdateEmployeeSchema({ today }: { today: string }) {
  return z
    .strictObject(fields(today))
    .partial()
    .refine((changes) => Object.keys(changes).length > 0, {
      message: 'Nothing to update',
      path: [],
      // an unknown key already explains why the body is unusable
      when: ({ issues }) => issues.length === 0,
    });
}
export type UpdateEmployeeInput = z.output<
  ReturnType<typeof buildUpdateEmployeeSchema>
>;

export const employeeListQuerySchema = paginationQuerySchema.extend({
  search: z
    .string()
    .trim()
    .max(100)
    .transform((value) => value || undefined)
    .optional(),
  departmentId: z.uuid().optional(),
  status: employeeStatusSchema.optional(),
  type: employeeTypeSchema.optional(),
  deleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
export type EmployeeListQuery = z.output<typeof employeeListQuerySchema>;
