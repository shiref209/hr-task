import type { TaxTable } from '@hr/types';
import { useEffect } from 'react';
import { toApiError } from '../../../shared/http/http-client';
import { ConfirmDialog, useToast } from '../../../shared/ui';
import { useDeleteTaxTable } from '../api/use-tax-table-mutations';

interface TaxTableDeleteDialogProps {
  table: TaxTable | null;
  onClose: () => void;
}

export function TaxTableDeleteDialog({ table, onClose }: TaxTableDeleteDialogProps) {
  const { mutate, reset, isPending, error } = useDeleteTaxTable();
  const toast = useToast();

  useEffect(() => {
    if (table) reset();
  }, [table, reset]);

  const confirm = () => {
    if (!table) return;
    mutate(table.id, {
      onSuccess: () => {
        toast.show({ variant: 'success', title: `${table.name} deleted` });
        onClose();
      },
    });
  };

  const problem = error ? toApiError(error).problem : null;

  return (
    <ConfirmDialog
      open={table !== null}
      title={`Delete ${table?.name ?? ''}?`}
      description="This cannot be undone."
      confirmLabel="Delete"
      tone="danger"
      isConfirming={isPending}
      error={problem ? (problem.detail ?? problem.title) : undefined}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
