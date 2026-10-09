import { useQuery } from '@tanstack/react-query';
import { fetchDepartments } from './employees-api';
import { departmentKeys } from './employee-keys';

export function useDepartments() {
  return useQuery({
    queryKey: departmentKeys.all,
    queryFn: fetchDepartments,
    staleTime: Infinity, // departments rarely change within a session
  });
}
