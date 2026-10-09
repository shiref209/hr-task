import { z } from 'zod';
import { paginationQuerySchema } from '../common/pagination';

export const employeeStatusSchema = z.enum(['ACTIVE', 'INACTIVE']);
export const employeeTypeSchema = z.enum(['HR', 'EMPLOYEE']);
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

const requiredText = z
  .string()
  .trim()
  .min(1, 'Required')
  .max(100, 'Must be at most 100 characters');

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(
    z.email('Invalid email address').max(254, 'Must be at most 254 characters'),
  );

const E164 = /^\+[1-9]\d{7,14}$/;
const phone = z
  .string()
  .transform((value) => value.replace(/[\s\-()]/g, ''))
  .refine(
    (value) => value === '' || E164.test(value),
    'Must be an international number like +201001234567',
  )
  .transform((value) => value || null)
  .nullable();

// Max 10 integer digits + 2 decimals = NUMERIC(12,2); inputs are validated, never rounded.
const baseSalary = z
  .string()
  .regex(
    /^\d{1,10}(\.\d{1,2})?$/,
    'Must be a positive amount with at most 2 decimal places',
  )
  .refine((value) => /[1-9]/.test(value), 'Must be greater than 0');

const fields = (today: string) => ({
  fullName: requiredText,
  email,
  phone,
  jobTitle: requiredText,
  departmentId: z.uuid('Invalid department id'),
  hireDate: z.iso
    .date('Must be a real date as YYYY-MM-DD')
    .refine((date) => date <= today, 'Cannot be in the future')
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
