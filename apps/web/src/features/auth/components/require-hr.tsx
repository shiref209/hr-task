import { Outlet } from 'react-router-dom';
import { EmptyState } from '../../../shared/ui';
import { useSession } from '../api/use-session';

/** UX only: the API enforces HR-only endpoints. */
export function RequireHr() {
  const { data } = useSession();
  return data?.role === 'HR' ? (
    <Outlet />
  ) : (
    <EmptyState title="You don't have access" description="Only HR can open this page." />
  );
}
