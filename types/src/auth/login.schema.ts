import { z } from 'zod';
import { employeeTypeSchema } from '../employees/employee.schema';

export const loginSchema = z.object({
  email: z
    .string({ error: 'Email is required' })
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address')),
  // Not trimmed: spaces can be part of a password.
  password: z
    .string({ error: 'Password is required' })
    .min(1, 'Password is required'),
});
export type LoginInput = z.output<typeof loginSchema>;

export const roleSchema = employeeTypeSchema;
export type Role = z.infer<typeof roleSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: roleSchema,
  employee: z.object({ id: z.uuid(), fullName: z.string() }),
});
export type AuthUser = z.infer<typeof authUserSchema>;
