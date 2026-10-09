import type {
  ApiResponse,
  CreateEmployeeInput,
  Department,
  Employee,
  EmployeeListQuery,
  PaginationMeta,
  UpdateEmployeeInput,
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

export async function fetchEmployee(id: string): Promise<Employee> {
  const { data } = await http.get<ApiResponse<Employee>>(`/employees/${id}`);
  return data.data;
}

export async function createEmployee(input: CreateEmployeeInput): Promise<Employee> {
  const { data } = await http.post<ApiResponse<Employee>>('/employees', input);
  return data.data;
}

export async function updateEmployee(
  id: string,
  changes: UpdateEmployeeInput,
): Promise<Employee> {
  const { data } = await http.patch<ApiResponse<Employee>>(`/employees/${id}`, changes);
  return data.data;
}

export async function uploadProfileImage(id: string, file: File): Promise<Employee> {
  const body = new FormData();
  body.append('file', file);
  const { data } = await http.post<ApiResponse<Employee>>(`/employees/${id}/profile-image`, body);
  return data.data;
}
