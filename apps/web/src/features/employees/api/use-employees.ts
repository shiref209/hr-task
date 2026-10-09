import type { EmployeeListQuery } from '@hr/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchEmployees } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useEmployees(query: EmployeeListQuery) {
  return useQuery({
    queryKey: employeeKeys.list(query),
    queryFn: () => fetchEmployees(query),
    placeholderData: keepPreviousData, // no flicker when paging/filtering
  });
}
