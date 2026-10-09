import type { UpdateEmployeeInput } from '@hr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateEmployee } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: string; changes: UpdateEmployeeInput }) =>
      updateEmployee(id, changes),
    onSuccess: (employee) => {
      // The response is the fresh detail; refetching it would only race the drawer.
      queryClient.setQueryData(employeeKeys.detail(employee.id), employee);
      return queryClient.invalidateQueries({ queryKey: employeeKeys.lists });
    },
  });
}
