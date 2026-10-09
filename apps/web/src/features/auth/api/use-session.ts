import type { AuthUser } from '@hr/types';
import { useQuery } from '@tanstack/react-query';
import { toApiError } from '../../../shared/http/http-client';
import { fetchMe } from './auth-api';

export const sessionKey = ['session'] as const;

/** `data` is the signed-in user, or `null` when signed out (including a 401 from /auth/me). */
export function useSession() {
  return useQuery({
    queryKey: sessionKey,
    queryFn: async (): Promise<AuthUser | null> => {
      try {
        return await fetchMe();
      } catch (error) {
        if (toApiError(error).status === 401) return null;
        throw error;
      }
    },
    retry: false,
    staleTime: Infinity, // changes only through sign-in / sign-out / an expired session
  });
}
