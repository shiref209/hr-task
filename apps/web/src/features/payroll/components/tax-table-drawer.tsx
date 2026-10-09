import type { TaxTable, TaxTableInput } from '@hr/types';
import { useId, useState } from 'react';
import { saveOrMapErrors } from '../../../shared/forms/api-error-to-form';
import { useDiscardGuard } from '../../../shared/forms/use-discard-guard';
import { Button, Drawer, useToast } from '../../../shared/ui';
import { useCreateTaxTable, useUpdateTaxTable } from '../api/use-tax-table-mutations';
import { emptyTaxTableValues, toFormValues } from '../form/tax-table-values';
import { TaxTableForm } from './tax-table-form';

export type TaxTableDrawerTarget = { mode: 'create' } | { mode: 'edit'; table: TaxTable };

interface TaxTableDrawerProps {
  target: TaxTableDrawerTarget | null;
  onClose: () => void;
}

export function TaxTableDrawer({ target, onClose }: TaxTableDrawerProps) {
  const formId = useId();
  const toast = useToast();
  const createTable = useCreateTaxTable();
  const updateTable = useUpdateTaxTable();
  const [dirty, setDirty] = useState(false);

  const isSaving = createTable.isPending || updateTable.isPending;
  const isEdit = target?.mode === 'edit';
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, isSaving, onClose });

  const save = (input: TaxTableInput) =>
    saveOrMapErrors(
      async () => {
        if (target?.mode === 'edit') {
          await updateTable.mutateAsync({ id: target.table.id, input });
          toast.show({ variant: 'success', title: 'Changes saved' });
        } else {
          await createTable.mutateAsync(input);
          toast.show({ variant: 'success', title: 'Tax table created' });
        }
        onClose();
      },
      { toast, failureTitle: 'Could not save tax table', conflictField: 'name' },
    );

  const title = target?.mode === 'edit' ? `Edit ${target.table.name}` : 'New tax table';

  return (
    <>
      <Drawer
        open={target !== null}
        title={title}
        onRequestClose={requestClose}
        footer={
          <>
            <Button variant="secondary" onClick={requestClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} disabled={isEdit && !dirty} isLoading={isSaving}>
              Save
            </Button>
          </>
        }
      >
        {target === null ? null : (
          <TaxTableForm
            id={formId}
            initial={target.mode === 'edit' ? toFormValues(target.table) : emptyTaxTableValues}
            isSaving={isSaving}
            onSubmit={save}
            onDirtyChange={setDirty}
          />
        )}
      </Drawer>
      {discardDialog}
    </>
  );
}
