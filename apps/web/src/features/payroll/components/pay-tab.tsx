import type { Employee } from '@hr/types';
import { ErrorView, Skeleton } from '../../../shared/ui';
import { usePayItems } from '../api/use-pay-items';
import { useTaxTables } from '../api/use-tax-tables';
import { PayForm } from './pay-form';

interface PayTabProps {
  employee: Employee;
  onDirtyChange: (dirty: boolean) => void;
  onSaved: () => void;
}

export function PayTab({ employee, onDirtyChange, onSaved }: PayTabProps) {
  const tables = useTaxTables();
  const items = usePayItems(employee.id);

  if (tables.isError) return <ErrorView error={tables.error} onRetry={() => void tables.refetch()} />;
  if (items.isError) return <ErrorView error={items.error} onRetry={() => void items.refetch()} />;
  if (tables.data === undefined || items.data === undefined) {
    return (
      <div aria-busy="true">
        <Skeleton variant="rect" />
      </div>
    );
  }
  return (
    <PayForm
      employee={employee}
      tables={tables.data}
      items={items.data}
      onDirtyChange={onDirtyChange}
      onSaved={onSaved}
    />
  );
}
