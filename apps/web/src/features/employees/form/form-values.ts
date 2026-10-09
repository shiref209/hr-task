import type {
  CreateEmployeeInput,
  Employee,
  EmployeeStatus,
  EmployeeType,
  UpdateEmployeeInput,
} from '@hr/types';
import { normalizeSalary } from '../../../shared/forms/salary';

export interface EmployeeFormValues {
  fullName: string;
  email: string;
  baseSalary: string;
  jobTitle: string;
  departmentId: string;
  hireDate: string;
  phone: string;
  status: EmployeeStatus;
  type: EmployeeType;
}

export const emptyFormValues: EmployeeFormValues = {
  fullName: '',
  email: '',
  baseSalary: '',
  jobTitle: '',
  departmentId: '',
  hireDate: '',
  phone: '',
  status: 'ACTIVE',
  type: 'EMPLOYEE',
};

export function toFormValues(employee: Employee): EmployeeFormValues {
  return {
    fullName: employee.fullName,
    email: employee.email,
    baseSalary: employee.baseSalary,
    jobTitle: employee.jobTitle,
    departmentId: employee.department.id,
    hireDate: employee.hireDate,
    phone: employee.phone ?? '',
    status: employee.status,
    type: employee.type,
  };
}

export function toCreateInput(values: EmployeeFormValues): CreateEmployeeInput {
  return {
    ...values,
    baseSalary: normalizeSalary(values.baseSalary),
    phone: values.phone === '' ? null : values.phone,
  };
}

/** Compares the API representation, so a reformatted salary or an empty phone never counts as a change. */
export function changedFields(
  initial: EmployeeFormValues,
  current: EmployeeFormValues,
): Partial<UpdateEmployeeInput> {
  const before = toCreateInput(initial);
  const after = toCreateInput(current);
  const changes: Partial<UpdateEmployeeInput> = {};
  for (const key of Object.keys(after) as (keyof CreateEmployeeInput)[]) {
    if (after[key] !== before[key]) Object.assign(changes, { [key]: after[key] });
  }
  return changes;
}
