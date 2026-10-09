import type { TaxTableInput } from '@hr/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeKeys } from '../../employees/api/employee-keys';
import { createTaxTable, deleteTaxTable, setDefaultTaxTable, updateTaxTable } from './payroll-api';
import { payrollKeys } from './payroll-keys';

// Tables are shown on employees (names, default fallback), so employee queries go stale too.
function useRefreshTaxTables() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: payrollKeys.taxTables }),
      queryClient.invalidateQueries({ queryKey: employeeKeys.all }),
    ]);
}

export function useCreateTaxTable() {
  const refresh = useRefreshTaxTables();
  return useMutation({ mutationFn: (input: TaxTableInput) => createTaxTable(input), onSuccess: refresh });
}

export function useUpdateTaxTable() {
  const refresh = useRefreshTaxTables();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaxTableInput }) => updateTaxTable(id, input),
    onSuccess: refresh,
  });
}

export function useSetDefaultTaxTable() {
  const refresh = useRefreshTaxTables();
  return useMutation({ mutationFn: (id: string) => setDefaultTaxTable(id), onSuccess: refresh });
}

export function useDeleteTaxTable() {
  const refresh = useRefreshTaxTables();
  // Also on failure: a 404/409 means the list is stale.
  return useMutation({ mutationFn: (id: string) => deleteTaxTable(id), onSettled: refresh });
}
