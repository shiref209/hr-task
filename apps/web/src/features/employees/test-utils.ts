import { ProblemType, type Department, type Employee, type PaginationMeta } from '@hr/types';
import { toApiError } from '../../shared/http/http-client';

export const DEPARTMENT_IDS = {
  operations: '11111111-1111-4111-8111-111111111111',
  finance: '22222222-2222-4222-8222-222222222222',
} as const;

export const departments: Department[] = [
  { id: DEPARTMENT_IDS.operations, name: 'Operations' },
  { id: DEPARTMENT_IDS.finance, name: 'Finance' },
];

/** Builds an employee; `n` makes the id unique (a valid UUID). */
export function anEmployee(n: number, overrides: Partial<Employee> = {}): Employee {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fullName: `Employee ${n}`,
    email: `employee${n}@example.com`,
    phone: null,
    jobTitle: 'Ops Lead',
    department: departments[0],
    hireDate: '2024-01-15',
    baseSalary: '12500',
    status: 'ACTIVE',
    type: 'EMPLOYEE',
    profileImageUrl: null,
    deletedAt: null,
    createdAt: '2024-01-15T09:00:00.000Z',
    updatedAt: '2024-01-15T09:00:00.000Z',
    ...overrides,
  };
}

export function pageOf(
  items: Employee[],
  meta: Partial<PaginationMeta> = {},
): { items: Employee[]; meta: PaginationMeta } {
  return {
    items,
    meta: {
      page: 1,
      pageSize: 20,
      totalItems: items.length,
      totalPages: 1,
      ...meta,
    },
  };
}

/** An ApiError built the way the http client builds it from a problem+json response. */
export function problemError(status: number, title: string, detail: string) {
  return toApiError(
    Object.assign(new Error(title), {
      isAxiosError: true,
      response: {
        status,
        data: { type: ProblemType.conflict, title, status, detail },
        headers: { 'content-type': 'application/problem+json' },
      },
    }),
  );
}
