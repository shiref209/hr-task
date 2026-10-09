import type { EmployeeListQuery } from '@hr/types';

const all = ['employees'] as const;

export const employeeKeys = {
  all,
  lists: [...all, 'list'] as const,
  list: (query: EmployeeListQuery) => [...all, 'list', query] as const,
  detail: (id: string) => [...all, 'detail', id] as const,
};

export const departmentKeys = {
  all: ['departments'] as const,
};
