import {
  employeeStatusSchema,
  idParamSchema,
  type EmployeeListQuery,
  type EmployeeStatus,
} from '@hr/types';

export const PAGE_SIZE = 20;
const SEARCH_MAX_LENGTH = 100;

export interface EmployeeListState {
  search: string;
  departmentId?: string;
  status?: EmployeeStatus;
  deleted: boolean;
  page: number;
}

export const defaultListState: EmployeeListState = {
  search: '',
  deleted: false,
  page: 1,
};

export function parseListState(params: URLSearchParams): EmployeeListState {
  const departmentId = idParamSchema.shape.id.safeParse(params.get('departmentId'));
  const status = employeeStatusSchema.safeParse(params.get('status'));
  const page = params.get('page') ?? '';
  return {
    search: (params.get('search') ?? '').slice(0, SEARCH_MAX_LENGTH),
    ...(departmentId.success ? { departmentId: departmentId.data } : {}),
    ...(status.success ? { status: status.data } : {}),
    deleted: params.get('deleted') === 'true',
    page: /^[1-9]\d*$/.test(page) ? Number(page) : 1,
  };
}

export function toSearchParams(state: EmployeeListState): URLSearchParams {
  const params = new URLSearchParams();
  if (state.search) params.set('search', state.search);
  if (state.departmentId) params.set('departmentId', state.departmentId);
  if (state.status) params.set('status', state.status);
  if (state.deleted) params.set('deleted', 'true');
  if (state.page !== 1) params.set('page', String(state.page));
  return params;
}

export function toListQuery(
  state: EmployeeListState,
  debouncedSearch: string,
): EmployeeListQuery {
  const search = debouncedSearch.trim();
  return {
    ...(search ? { search } : {}),
    ...(state.departmentId ? { departmentId: state.departmentId } : {}),
    ...(state.status ? { status: state.status } : {}),
    deleted: state.deleted,
    page: state.page,
    pageSize: PAGE_SIZE,
  };
}
