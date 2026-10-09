import type { CreateEmployeeInput } from '@hr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createEmployee } from './employees-api';
import { employeeKeys } from './employee-keys';

export function useCreateEmployee() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEmployeeInput) => createEmployee(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: employeeKeys.lists }),
  });
}
