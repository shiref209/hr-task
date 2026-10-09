import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSessionExpiredHandler } from '../shared/http/http-client';

/** When a refresh fails the cache holds a dead user's data: drop it and send them to sign in. */
export function useSessionExpiredRedirect() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  useEffect(() => {
    setSessionExpiredHandler((currentPath) => {
      queryClient.clear();
      navigate(`/login?next=${encodeURIComponent(currentPath)}`, { replace: true });
    });
  }, [queryClient, navigate]);
}
