import type {
  ApiResponse,
  Department,
  Employee,
  EmployeeListQuery,
  PaginationMeta,
} from '@hr/types';
import { http } from '../../../shared/http/http-client';

export async function fetchEmployees(
  query: EmployeeListQuery,
): Promise<{ items: Employee[]; meta: PaginationMeta }> {
  const { data } = await http.get<ApiResponse<Employee[]>>('/employees', { params: query });
  if (!data.meta) throw new Error('Employee list response is missing pagination meta');
  return { items: data.data, meta: data.meta };
}

export async function fetchDepartments(): Promise<Department[]> {
  const { data } = await http.get<ApiResponse<Department[]>>('/departments');
  return data.data;
}

export async function restoreEmployee(id: string): Promise<Employee> {
  const { data } = await http.post<ApiResponse<Employee>>(`/employees/${id}/restore`);
  return data.data;
}
