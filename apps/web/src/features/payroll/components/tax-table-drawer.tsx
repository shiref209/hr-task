import type { TaxTable, TaxTableInput } from '@hr/types';
import { useId, useState } from 'react';
import { toApiError } from '../../../shared/http/http-client';
import { Button, ConfirmDialog, Drawer, useToast } from '../../../shared/ui';
import { apiErrorToForm } from '../../employees/form/api-error-to-form';
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
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const isSaving = createTable.isPending || updateTable.isPending;
  const isEdit = target?.mode === 'edit';

  const requestClose = () => {
    if (isSaving) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };

  const discard = () => {
    setConfirmingDiscard(false);
    onClose();
  };

  const save = async (input: TaxTableInput) => {
    try {
      if (target?.mode === 'edit') {
        await updateTable.mutateAsync({ id: target.table.id, input });
        toast.show({ variant: 'success', title: 'Changes saved' });
      } else {
        await createTable.mutateAsync(input);
        toast.show({ variant: 'success', title: 'Tax table created' });
      }
      onClose();
      return undefined;
    } catch (cause) {
      const error = toApiError(cause);
      const mapped = apiErrorToForm(error, 'name');
      if (Object.keys(mapped.fieldErrors).length === 0 && !mapped.formError) {
        toast.show({
          variant: 'error',
          title: 'Could not save tax table',
          description: error.problem.detail ?? error.problem.title,
        });
      }
      return mapped;
    }
  };

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
      <ConfirmDialog
        open={confirmingDiscard}
        title="Discard unsaved changes?"
        description="Your changes will be lost."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={discard}
        onCancel={() => setConfirmingDiscard(false)}
      />
    </>
  );
}
