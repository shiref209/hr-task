import type { ApiResponse, AppliedTaxTable, AuthUser, LoginInput } from '@hr/types';
import { http, toApiError, unwrap } from '../../../shared/http/http-client';

export async function login(input: LoginInput): Promise<AuthUser> {
  const { user } = await unwrap(http.post<ApiResponse<{ user: AuthUser }>>('/auth/login', input));
  return user;
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout');
}

/** `null` when nobody is signed in. */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { user } = await unwrap(http.get<ApiResponse<{ user: AuthUser }>>('/auth/me'));
    return user;
  } catch (error) {
    if (toApiError(error).status === 401) return null;
    throw error;
  }
}

export function fetchMyTaxTable(): Promise<AppliedTaxTable> {
  return unwrap(http.get<ApiResponse<AppliedTaxTable>>('/me/tax-table'));
}
