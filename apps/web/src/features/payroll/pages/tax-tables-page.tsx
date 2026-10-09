import type { TaxTable } from '@hr/types';
import { useCallback, useState } from 'react';
import { toApiError } from '../../../shared/http/http-client';
import { Button, EmptyState, ErrorView, Skeleton, useToast } from '../../../shared/ui';
import { useSetDefaultTaxTable } from '../api/use-tax-table-mutations';
import { useTaxTables } from '../api/use-tax-tables';
import { TaxTableCard } from '../components/tax-table-card';
import { TaxTableDeleteDialog } from '../components/tax-table-delete-dialog';
import { TaxTableDrawer, type TaxTableDrawerTarget } from '../components/tax-table-drawer';
import '../payroll.scss';

const SKELETON_CARDS = 3;

export function TaxTablesPage() {
  const [drawer, setDrawer] = useState<TaxTableDrawerTarget | null>(null);
  const [deleting, setDeleting] = useState<TaxTable | null>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const tables = useTaxTables();
  const setDefault = useSetDefaultTaxTable();
  const toast = useToast();

  const onCreate = () => setDrawer({ mode: 'create' });

  const onSetDefault = (table: TaxTable) =>
    setDefault.mutate(table.id, {
      onSuccess: () => toast.show({ variant: 'success', title: `${table.name} is now the default` }),
      onError: (error) => {
        const { problem } = toApiError(error);
        toast.show({
          variant: 'error',
          title: 'Could not set the default',
          description: problem.detail ?? problem.title,
        });
      },
    });

  const renderBody = () => {
    if (tables.isPending) {
      return (
        <div className="payroll-page__list" aria-busy="true">
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <Skeleton key={index} variant="rect" />
          ))}
        </div>
      );
    }
    if (tables.isError) return <ErrorView error={tables.error} onRetry={() => void tables.refetch()} />;
    if (tables.data.length === 0) {
      return <EmptyState title="No tax tables yet" />;
    }
    // Stable sort: the default first, the API order otherwise.
    const ordered = [...tables.data].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
    return (
      <div className="payroll-page__list">
        {ordered.map((table) => (
          <TaxTableCard
            key={table.id}
            table={table}
            onEdit={(target) => setDrawer({ mode: 'edit', table: target })}
            onSetDefault={onSetDefault}
            onDelete={setDeleting}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="payroll-page">
      <div className="payroll-page__header">
        <h1 className="payroll-page__title">Tax tables</h1>
        <Button onClick={onCreate}>New table</Button>
      </div>
      {renderBody()}
      <TaxTableDeleteDialog table={deleting} onClose={closeDelete} />
      <TaxTableDrawer target={drawer} onClose={closeDrawer} />
    </div>
  );
}
