import { toApiError } from '../../http/http-client';
import { Button } from '../button/button';
import { EmptyState } from '../empty-state/empty-state';

interface ErrorViewProps {
  error: unknown;
  onRetry: () => void;
}

// Shows the Problem Details title/detail only, never the raw error object.
export function ErrorView({ error, onRetry }: ErrorViewProps) {
  const { problem } = toApiError(error);
  return (
    <div role="alert">
      <EmptyState
        title={problem.title}
        description={problem.detail}
        action={<Button onClick={onRetry}>Retry</Button>}
      />
    </div>
  );
}
