import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { toApiError } from '../../../shared/http/http-client';
import { Button, ConfirmDialog, Drawer, ErrorView, Skeleton, useToast } from '../../../shared/ui';
import { useDepartments } from '../api/use-departments';
import { useCreateEmployee } from '../api/use-create-employee';
import { useEmployee } from '../api/use-employee';
import { useUpdateEmployee } from '../api/use-update-employee';
import { employeeKeys } from '../api/employee-keys';
import { apiErrorToForm } from '../form/api-error-to-form';
import {
  changedFields,
  emptyFormValues,
  toCreateInput,
  toFormValues,
  type EmployeeFormValues,
} from '../form/form-values';
import { EmployeeForm } from './employee-form';
import { EmployeePhoto } from './employee-photo';

export type EmployeeDrawerTarget = { mode: 'create' } | { mode: 'edit'; id: string; name: string };

interface EmployeeDrawerProps {
  target: EmployeeDrawerTarget | null;
  onClose: () => void;
}

export function EmployeeDrawer({ target, onClose }: EmployeeDrawerProps) {
  const formId = useId();
  const toast = useToast();
  const queryClient = useQueryClient();
  const departments = useDepartments();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const employee = useEmployee(target?.mode === 'edit' ? target.id : undefined);
  const [dirty, setDirty] = useState(false);
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const isSaving = createEmployee.isPending || updateEmployee.isPending;
  const loadedEmployee = employee.data;
  const isEdit = target?.mode === 'edit';
  const notFound = employee.isError && toApiError(employee.error).status === 404;

  useEffect(() => {
    if (!notFound) return;
    toast.show({ variant: 'error', title: 'This employee no longer exists' });
    void queryClient.invalidateQueries({ queryKey: employeeKeys.lists });
    onClose();
  }, [notFound, toast, queryClient, onClose]);

  const requestClose = () => {
    if (isSaving) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };

  const discard = () => {
    setConfirmingDiscard(false);
    onClose();
  };

  const save = async (values: EmployeeFormValues) => {
    try {
      if (target?.mode === 'edit' && loadedEmployee) {
        const changes = changedFields(toFormValues(loadedEmployee), values);
        await updateEmployee.mutateAsync({ id: target.id, changes });
        toast.show({ variant: 'success', title: 'Changes saved' });
      } else {
        await createEmployee.mutateAsync(toCreateInput(values));
        toast.show({ variant: 'success', title: 'Employee created' });
      }
      onClose();
      return undefined;
    } catch (cause) {
      const error = toApiError(cause);
      const mapped = apiErrorToForm(error);
      if (Object.keys(mapped.fieldErrors).length === 0 && !mapped.formError) {
        toast.show({
          variant: 'error',
          title: 'Could not save employee',
          description: error.problem.detail ?? error.problem.title,
        });
      }
      return mapped;
    }
  };

  const renderBody = () => {
    if (target === null) return null;
    if (isEdit && employee.isError) {
      return <ErrorView error={employee.error} onRetry={() => void employee.refetch()} />;
    }
    if (isEdit && !loadedEmployee) {
      return (
        <div aria-busy="true">
          <Skeleton variant="rect" />
        </div>
      );
    }
    return (
      <>
        {loadedEmployee ? (
          <EmployeePhoto employee={loadedEmployee} />
        ) : (
          <p className="employee-drawer__hint">You can add a photo after saving.</p>
        )}
        <EmployeeForm
          id={formId}
          mode={target.mode}
          initial={loadedEmployee ? toFormValues(loadedEmployee) : emptyFormValues}
          departments={departments.data ?? []}
          isSaving={isSaving}
          onSubmit={save}
          onDirtyChange={setDirty}
        />
      </>
    );
  };

  const canSave = isEdit ? loadedEmployee !== undefined && dirty : true;
  const title = target?.mode === 'edit' ? `Edit ${loadedEmployee?.fullName ?? target.name}` : 'New employee';

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
            <Button type="submit" form={formId} disabled={!canSave} isLoading={isSaving}>
              Save
            </Button>
          </>
        }
      >
        <div className="employee-drawer">{renderBody()}</div>
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
