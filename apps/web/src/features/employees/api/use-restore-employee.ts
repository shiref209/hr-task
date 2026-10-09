import { useMutation, useQueryClient } from '@tanstack/react-query';
import { restoreEmployee } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useRestoreEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => restoreEmployee(id),
    // Also on failure: a 409 means someone else already changed this row.
    onSettled: () => queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
  });
}
