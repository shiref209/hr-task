import { Link } from 'react-router-dom';
import { EmptyState } from '../shared/ui';

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="The page you are looking for does not exist."
      action={<Link to="/employees">Back to employees</Link>}
    />
  );
}
