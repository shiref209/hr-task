import { useQuery } from '@tanstack/react-query';
import { fetchTaxTables } from './payroll-api';
import { payrollKeys } from './payroll-keys';

export function useTaxTables() {
  return useQuery({ queryKey: payrollKeys.taxTables, queryFn: fetchTaxTables });
}
