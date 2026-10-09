import type {
  ApiResponse,
  CreateEmployeeInput,
  Department,
  Employee,
  EmployeeListQuery,
  PaginationMeta,
  UpdateEmployeeInput,
} from '@hr/types';
import { http, unwrap } from '../../../shared/http/http-client';

export async function fetchEmployees(
  query: EmployeeListQuery,
): Promise<{ items: Employee[]; meta: PaginationMeta }> {
  const { data } = await http.get<ApiResponse<Employee[]>>('/employees', { params: query });
  if (!data.meta) throw new Error('Employee list response is missing pagination meta');
  return { items: data.data, meta: data.meta };
}

export function fetchDepartments(): Promise<Department[]> {
  return unwrap(http.get<ApiResponse<Department[]>>('/departments'));
}

export function restoreEmployee(id: string): Promise<Employee> {
  return unwrap(http.post<ApiResponse<Employee>>(`/employees/${id}/restore`));
}

export async function deleteEmployee(id: string): Promise<void> {
  await http.delete(`/employees/${id}`);
}

export function fetchEmployee(id: string): Promise<Employee> {
  return unwrap(http.get<ApiResponse<Employee>>(`/employees/${id}`));
}

export function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  return unwrap(http.post<ApiResponse<Employee>>('/employees', input));
}

export function updateEmployee(
  id: string,
  changes: UpdateEmployeeInput,
): Promise<Employee> {
  return unwrap(http.patch<ApiResponse<Employee>>(`/employees/${id}`, changes));
}

export function uploadProfileImage(id: string, file: File): Promise<Employee> {
  const body = new FormData();
  body.append('file', file);
  return unwrap(http.post<ApiResponse<Employee>>(`/employees/${id}/profile-image`, body));
}
