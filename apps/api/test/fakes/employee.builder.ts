import { randomUUID } from 'node:crypto';
import type { CreateEmployeeInput, Department, Employee } from '@hr/types';

export const ENGINEERING: Department = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Engineering',
};
export const HUMAN_RESOURCES: Department = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Human Resources',
};
export const FINANCE: Department = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Finance',
};

let sequence = 0;

export function anEmployee(overrides: Partial<Employee> = {}): Employee {
  sequence += 1;
  return {
    id: randomUUID(),
    fullName: `Employee ${String(sequence).padStart(3, '0')}`,
    email: `employee${sequence}@example.com`,
    phone: null,
    jobTitle: 'Engineer',
    department: ENGINEERING,
    hireDate: '2024-01-15',
    baseSalary: '5000.00',
    status: 'ACTIVE',
    type: 'EMPLOYEE',
    profileImageUrl: null,
    deletedAt: null,
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-01-15T09:00:00.000Z',
    ...overrides,
  };
}

export function anActiveHr(overrides: Partial<Employee> = {}): Employee {
  return anEmployee({ type: 'HR', status: 'ACTIVE', ...overrides });
}

export function aDeletedEmployee(overrides: Partial<Employee> = {}): Employee {
  return anEmployee({ deletedAt: '2026-01-01T00:00:00.000Z', ...overrides });
}

export function aCreateEmployeeInput(
  overrides: Partial<CreateEmployeeInput> = {},
): CreateEmployeeInput {
  return {
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    jobTitle: 'Engineer',
    departmentId: ENGINEERING.id,
    hireDate: '2024-01-15',
    baseSalary: '5000.00',
    status: 'ACTIVE',
    type: 'EMPLOYEE',
    ...overrides,
  };
}
