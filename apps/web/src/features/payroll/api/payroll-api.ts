import type {
  ApiResponse,
  PayItems,
  Payslip,
  SocialInsurance,
  TaxTable,
  TaxTableInput,
} from '@hr/types';
import { http, unwrap } from '../../../shared/http/http-client';

export function fetchTaxTables(): Promise<TaxTable[]> {
  return unwrap(http.get<ApiResponse<TaxTable[]>>('/tax-tables'));
}

export function createTaxTable(input: TaxTableInput): Promise<TaxTable> {
  return unwrap(http.post<ApiResponse<TaxTable>>('/tax-tables', input));
}

export function updateTaxTable(id: string, input: TaxTableInput): Promise<TaxTable> {
  return unwrap(http.put<ApiResponse<TaxTable>>(`/tax-tables/${id}`, input));
}

export function setDefaultTaxTable(id: string): Promise<TaxTable> {
  return unwrap(http.post<ApiResponse<TaxTable>>(`/tax-tables/${id}/default`));
}

export async function deleteTaxTable(id: string): Promise<void> {
  await http.delete(`/tax-tables/${id}`);
}

export function fetchSocialInsurance(): Promise<SocialInsurance> {
  return unwrap(http.get<ApiResponse<SocialInsurance>>('/payroll-settings/social-insurance'));
}

export function updateSocialInsurance(input: SocialInsurance): Promise<SocialInsurance> {
  return unwrap(http.put<ApiResponse<SocialInsurance>>('/payroll-settings/social-insurance', input));
}

export function fetchPayItems(employeeId: string): Promise<PayItems> {
  return unwrap(http.get<ApiResponse<PayItems>>(`/employees/${employeeId}/pay-items`));
}

export function replacePayItems(employeeId: string, items: PayItems): Promise<PayItems> {
  return unwrap(http.put<ApiResponse<PayItems>>(`/employees/${employeeId}/pay-items`, items));
}

export function fetchPayslip(employeeId: string, month: string): Promise<Payslip> {
  return unwrap(http.get<ApiResponse<Payslip>>(`/employees/${employeeId}/payslip`, { params: { month } }));
}
