import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { saveOrMapErrors } from '../../../shared/forms/api-error-to-form';
import { useDiscardGuard } from '../../../shared/forms/use-discard-guard';
import { toApiError } from '../../../shared/http/http-client';
import { Button, Drawer, ErrorView, Skeleton, Tabs, useToast } from '../../../shared/ui';
import { useDepartments } from '../api/use-departments';
import { useCreateEmployee } from '../api/use-create-employee';
import { useEmployee } from '../api/use-employee';
import { useUpdateEmployee } from '../api/use-update-employee';
import { employeeKeys } from '../api/employee-keys';
import {
  changedFields,
  emptyFormValues,
  toCreateInput,
  toFormValues,
  type EmployeeFormValues,
} from '../form/form-values';
import { PayTab } from '../../payroll/components/pay-tab';
import { EmployeeForm } from './employee-form';
import { EmployeePhoto } from './employee-photo';

type DrawerTab = 'details' | 'pay';
const TABS = [
  { id: 'details', label: 'Details' },
  { id: 'pay', label: 'Pay' },
];

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
  const [detailsDirty, setDetailsDirty] = useState(false);
  const [payDirty, setPayDirty] = useState(false);
  const [tab, setTab] = useState<DrawerTab>('details');
  // The Pay tab loads on first visit, then stays mounted so unsaved input survives tab switches.
  const [payVisited, setPayVisited] = useState(false);

  const dirty = detailsDirty || payDirty;
  const isSaving = createEmployee.isPending || updateEmployee.isPending;
  const loadedEmployee = employee.data;
  const isEdit = target?.mode === 'edit';
  const notFound = employee.isError && toApiError(employee.error).status === 404;
  const { requestClose, discardDialog } = useDiscardGuard({ dirty, isSaving, onClose });

  useEffect(() => {
    if (!notFound) return;
    toast.show({ variant: 'error', title: 'This employee no longer exists' });
    void queryClient.invalidateQueries({ queryKey: employeeKeys.lists });
    onClose();
  }, [notFound, toast, queryClient, onClose]);

  const [previousTarget, setPreviousTarget] = useState(target);
  if (target !== previousTarget) {
    setPreviousTarget(target);
    setTab('details');
    setPayVisited(false);
  }

  const selectTab = (id: string) => {
    const next = id === 'pay' ? 'pay' : 'details';
    if (next === 'pay') setPayVisited(true);
    setTab(next);
  };

  const save = (values: EmployeeFormValues) =>
    saveOrMapErrors(
      async () => {
        if (target?.mode === 'edit' && loadedEmployee) {
          const changes = changedFields(toFormValues(loadedEmployee), values);
          await updateEmployee.mutateAsync({ id: target.id, changes });
          toast.show({ variant: 'success', title: 'Changes saved' });
        } else {
          await createEmployee.mutateAsync(toCreateInput(values));
          toast.show({ variant: 'success', title: 'Employee created' });
        }
        onClose();
      },
      { toast, failureTitle: 'Could not save employee' },
    );

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
    const details = (
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
          onDirtyChange={setDetailsDirty}
        />
      </>
    );
    if (!loadedEmployee) return details;
    return (
      <Tabs tabs={TABS} activeId={tab} onChange={selectTab}>
        <div className="employee-drawer__panel" hidden={tab !== 'details'}>
          {details}
        </div>
        {payVisited ? (
          <div className="employee-drawer__panel" hidden={tab !== 'pay'}>
            <PayTab
              employee={loadedEmployee}
              onDirtyChange={setPayDirty}
              onSaved={onClose}
            />
          </div>
        ) : null}
      </Tabs>
    );
  };

  const canSave = isEdit ? loadedEmployee !== undefined && detailsDirty : true;
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
            {isEdit && tab === 'pay' ? null : (
              <Button type="submit" form={formId} disabled={!canSave} isLoading={isSaving}>
                Save
              </Button>
            )}
          </>
        }
      >
        <div className="employee-drawer">{renderBody()}</div>
      </Drawer>
      {discardDialog}
    </>
  );
}
