import type {
  ApiResponse,
  PayItems,
  Payslip,
  SocialInsurance,
  TaxTable,
  TaxTableInput,
} from '@hr/types';
import { http } from '../../../shared/http/http-client';

export async function fetchTaxTables(): Promise<TaxTable[]> {
  const { data } = await http.get<ApiResponse<TaxTable[]>>('/tax-tables');
  return data.data;
}

export async function createTaxTable(input: TaxTableInput): Promise<TaxTable> {
  const { data } = await http.post<ApiResponse<TaxTable>>('/tax-tables', input);
  return data.data;
}

export async function updateTaxTable(id: string, input: TaxTableInput): Promise<TaxTable> {
  const { data } = await http.put<ApiResponse<TaxTable>>(`/tax-tables/${id}`, input);
  return data.data;
}

export async function setDefaultTaxTable(id: string): Promise<TaxTable> {
  const { data } = await http.post<ApiResponse<TaxTable>>(`/tax-tables/${id}/default`);
  return data.data;
}

export async function deleteTaxTable(id: string): Promise<void> {
  await http.delete(`/tax-tables/${id}`);
}

export async function fetchSocialInsurance(): Promise<SocialInsurance> {
  const { data } = await http.get<ApiResponse<SocialInsurance>>('/payroll-settings/social-insurance');
  return data.data;
}

export async function updateSocialInsurance(input: SocialInsurance): Promise<SocialInsurance> {
  const { data } = await http.put<ApiResponse<SocialInsurance>>(
    '/payroll-settings/social-insurance',
    input,
  );
  return data.data;
}

export async function fetchPayItems(employeeId: string): Promise<PayItems> {
  const { data } = await http.get<ApiResponse<PayItems>>(`/employees/${employeeId}/pay-items`);
  return data.data;
}

export async function replacePayItems(employeeId: string, items: PayItems): Promise<PayItems> {
  const { data } = await http.put<ApiResponse<PayItems>>(`/employees/${employeeId}/pay-items`, items);
  return data.data;
}

export async function fetchPayslip(employeeId: string, month: string): Promise<Payslip> {
  const { data } = await http.get<ApiResponse<Payslip>>(`/employees/${employeeId}/payslip`, {
    params: { month },
  });
  return data.data;
}
