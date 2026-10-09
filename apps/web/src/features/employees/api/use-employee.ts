import { useQuery } from '@tanstack/react-query';
import { fetchEmployee } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: employeeKeys.detail(id ?? ''),
    queryFn: () => fetchEmployee(id ?? ''),
    enabled: id !== undefined,
  });
}
