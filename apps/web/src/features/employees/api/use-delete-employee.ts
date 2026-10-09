import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteEmployee } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEmployee(id),
    // Also on failure: a 404 means the list is stale. onSettled is awaited, so the list is fresh when callers' onSuccess runs.
    onSettled: () => queryClient.invalidateQueries({ queryKey: employeeKeys.lists }),
  });
}
