import type { PayItems } from '@hr/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPayItems, replacePayItems } from './payroll-api';
import { payrollKeys } from './payroll-keys';

export function usePayItems(employeeId: string) {
  return useQuery({
    queryKey: payrollKeys.payItems(employeeId),
    queryFn: () => fetchPayItems(employeeId),
  });
}

export function useReplacePayItems(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: PayItems) => replacePayItems(employeeId, items),
    onSuccess: (saved) => {
      queryClient.setQueryData(payrollKeys.payItems(employeeId), saved);
      // Payslips for every month depend on the items.
      return queryClient.invalidateQueries({ queryKey: payrollKeys.payslips(employeeId) });
    },
  });
}
