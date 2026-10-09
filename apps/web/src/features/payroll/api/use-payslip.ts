import { payslipQuerySchema } from '@hr/types';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { fetchPayslip } from './payroll-api';
import { payrollKeys } from './payroll-keys';

export function usePayslip(employeeId: string, month: string) {
  return useQuery({
    queryKey: payrollKeys.payslip(employeeId, month),
    queryFn: () => fetchPayslip(employeeId, month),
    enabled: payslipQuerySchema.safeParse({ month }).success, // a cleared month input is not a request
    placeholderData: keepPreviousData, // previous month stays visible while the next loads
  });
}
