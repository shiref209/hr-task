import type { Employee } from '@hr/types';
import { useEffect } from 'react';
import { toApiError } from '../../../shared/http/http-client';
import { ConfirmDialog, useToast } from '../../../shared/ui';
import { useDeleteEmployee } from '../api/use-delete-employee';

interface EmployeeDeleteDialogProps {
  employee: Employee | null;
  onClose: () => void;
  onDeleted: (employee: Employee) => void;
}

export function EmployeeDeleteDialog({ employee, onClose, onDeleted }: EmployeeDeleteDialogProps) {
  const { mutate, reset, isPending, error } = useDeleteEmployee();
  const toast = useToast();

  useEffect(() => {
    if (employee) reset();
  }, [employee, reset]);

  const confirm = () => {
    if (!employee) return;
    mutate(employee.id, {
      onSuccess: () => {
        toast.show({ variant: 'success', title: `${employee.fullName} deleted` });
        onDeleted(employee);
      },
      onError: (failure) => {
        if (toApiError(failure).status !== 404) return;
        toast.show({ variant: 'info', title: 'This employee was already deleted' });
        onClose();
      },
    });
  };

  const problem = error ? toApiError(error) : null;
  const isLastHr = problem?.status === 422;

  return (
    <ConfirmDialog
      open={employee !== null}
      title={`Delete ${employee?.fullName ?? ''}?`}
      description="They'll be hidden from the list. You can restore them from Show deleted."
      confirmLabel="Delete"
      cancelLabel={isLastHr ? 'Close' : 'Cancel'}
      tone="danger"
      isConfirming={isPending}
      confirmDisabled={isLastHr}
      error={problem?.message}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
