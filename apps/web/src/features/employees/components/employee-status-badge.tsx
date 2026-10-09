import type { EmployeeStatus } from '@hr/types';
import { Badge } from '../../../shared/ui';

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return status === 'ACTIVE' ? (
    <Badge tone="success">Active</Badge>
  ) : (
    <Badge tone="neutral">Inactive</Badge>
  );
}
