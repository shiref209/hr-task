import { createEmployeeSchema, updateEmployeeSchema } from '@hr/types';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Resolver } from 'react-hook-form';
import type { EmployeeFormValues } from './form-values';
import { normalizeSalary } from './salary';

/** Validates with the shared schemas; the salary is normalized first because the schema only knows the API format. */
export function employeeResolver(mode: 'create' | 'edit'): Resolver<EmployeeFormValues> {
  // Edit may carry fields the form doesn't edit yet (taxTableId), so its output is wider than the form values.
  const schema: Parameters<typeof zodResolver>[0] = mode === 'create' ? createEmployeeSchema : updateEmployeeSchema;
  // The schemas take a looser input (optional keys) than the form's values, which always carry every key.
  const validate = zodResolver(schema, undefined, { raw: true }) as unknown as Resolver<EmployeeFormValues>;
  return (values, context, options) =>
    validate({ ...values, baseSalary: normalizeSalary(values.baseSalary) }, context, options);
}
