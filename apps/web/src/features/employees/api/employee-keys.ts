import type { EmployeeListQuery } from '@hr/types';

export const employeeKeys = {
  all: ['employees'] as const,
  list: (query: EmployeeListQuery) => [...employeeKeys.all, 'list', query] as const,
  detail: (id: string) => [...employeeKeys.all, 'detail', id] as const,
};

export const departmentKeys = {
  all: ['departments'] as const,
};
