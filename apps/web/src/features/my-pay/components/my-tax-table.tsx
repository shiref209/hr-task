import { Badge, Card, ErrorView, Skeleton } from '../../../shared/ui';
import { TaxBracketList } from '../../payroll/components/tax-bracket-list';
import { useMyTaxTable } from '../api/use-my-tax-table';

export function MyTaxTable() {
  const table = useMyTaxTable();

  if (table.isPending) return <Skeleton variant="rect" />;
  if (table.isError) return <ErrorView error={table.error} onRetry={() => void table.refetch()} />;
  return (
    <Card title="Your tax table">
      <p className="my-pay-page__table-name">
        {table.data.name} {table.data.isDefault ? <Badge tone="info">Default</Badge> : null}
      </p>
      <TaxBracketList brackets={table.data.brackets} />
    </Card>
  );
}
