import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorView, Skeleton } from '../../../shared/ui';
import { useSession } from '../api/use-session';

/** Route guard: signed-out visitors go to /login and come back to where they were. */
export function RequireAuth() {
  const { pathname, search } = useLocation();
  const session = useSession();

  if (session.isPending) {
    return (
      <div aria-busy="true">
        <Skeleton variant="rect" />
      </div>
    );
  }
  if (session.isError) return <ErrorView error={session.error} onRetry={() => void session.refetch()} />;
  if (session.data === null) {
    return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  }
  return <Outlet />;
}
