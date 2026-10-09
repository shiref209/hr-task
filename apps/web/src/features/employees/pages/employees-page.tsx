import type { Employee } from '@hr/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, EmptyState, ErrorView, Pagination, Skeleton, useToast } from '../../../shared/ui';
import { toApiError } from '../../../shared/http/http-client';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { useDepartments } from '../api/use-departments';
import { useEmployees } from '../api/use-employees';
import { useRestoreEmployee } from '../api/use-restore-employee';
import { PayslipDrawer, type PayslipTarget } from '../../payroll/components/payslip-drawer';
import { EmployeeDeleteDialog } from '../components/employee-delete-dialog';
import { EmployeeDrawer, type EmployeeDrawerTarget } from '../components/employee-drawer';
import { EmployeeFilters } from '../components/employee-filters';
import { EmployeeList } from '../components/employee-list';
import { toListQuery } from '../list-state';
import { useEmployeeListState } from '../use-employee-list-state';
import '../employees.scss';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 5;

export function EmployeesPage() {
  const [drawer, setDrawer] = useState<EmployeeDrawerTarget | null>(null);
  const [deleting, setDeleting] = useState<Employee | null>(null);
  const [payslip, setPayslip] = useState<PayslipTarget | null>(null);
  // Decided when the dialog opens, because the refetch removes the row from the list.
  const focusAfterDelete = useRef<string | 'new-employee' | null>(null);
  const newEmployeeButton = useRef<HTMLButtonElement>(null);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const closePayslip = useCallback(() => setPayslip(null), []);
  const onCreate = () => setDrawer({ mode: 'create' });
  const onEdit = (employee: Employee) =>
    setDrawer({ mode: 'edit', id: employee.id, name: employee.fullName });
  const { state, update, reset } = useEmployeeListState();
  const debouncedSearch = useDebouncedValue(state.search, SEARCH_DEBOUNCE_MS);
  const query = toListQuery(state, debouncedSearch);
  const employees = useEmployees(query);
  const departments = useDepartments();
  const restore = useRestoreEmployee();
  const toast = useToast();

  const { data, isPlaceholderData } = employees;
  const isPageEmpty = data !== undefined && !isPlaceholderData && data.items.length === 0;
  useEffect(() => {
    // A delete/restore emptied this page: step back instead of showing an empty page 3.
    if (isPageEmpty && state.page > 1) update({ page: state.page - 1 });
  }, [isPageEmpty, state.page, update]);

  const onRestore = (employee: Employee) =>
    restore.mutate(employee.id, {
      onSuccess: () => toast.show({ variant: 'success', title: `${employee.fullName} restored` }),
      onError: (error) => {
        toast.show({
          variant: 'error',
          title: 'Could not restore employee',
          description: toApiError(error).message,
        });
      },
    });

  const onDelete = (employee: Employee) => {
    const items = data?.items ?? [];
    const index = items.findIndex((item) => item.id === employee.id);
    focusAfterDelete.current =
      items[index + 1]?.id ?? items[index - 1]?.id ?? 'new-employee';
    setDeleting(employee);
  };

  useEffect(() => {
    const wanted = focusAfterDelete.current;
    if (wanted === null || deleting !== null || employees.isFetching) return;
    const target =
      wanted === 'new-employee'
        ? newEmployeeButton.current
        : document.querySelector<HTMLElement>(
            `[data-employee-id="${CSS.escape(wanted)}"] [aria-haspopup="menu"]`,
          );
    target?.focus();
    focusAfterDelete.current = null;
  }, [deleting, employees.isFetching, data]);

  const hasFilters = Boolean(query.search ?? query.departmentId ?? query.status);

  const renderBody = () => {
    if (employees.isPending) {
      return (
        <div className="employees-page__skeleton" aria-busy="true">
          {Array.from({ length: SKELETON_ROWS }, (_, index) => (
            <Skeleton key={index} variant="rect" />
          ))}
        </div>
      );
    }
    if (employees.isError) {
      return <ErrorView error={employees.error} onRetry={() => void employees.refetch()} />;
    }
    if (employees.data.items.length === 0) {
      if (query.deleted) return <EmptyState title="No deleted employees" />;
      if (hasFilters) {
        return (
          <EmptyState
            title="No employees match your filters"
            action={<Button variant="secondary" onClick={reset}>Clear filters</Button>}
          />
        );
      }
      return <EmptyState title="No employees yet" action={<Button onClick={onCreate}>New employee</Button>} />;
    }
    return (
      <>
        <EmployeeList
          employees={employees.data.items}
          busy={employees.isFetching}
          onRestore={onRestore}
          onEdit={onEdit}
          onPayslip={(employee) => setPayslip({ id: employee.id, name: employee.fullName })}
          onDelete={onDelete}
        />
        <Pagination
          page={employees.data.meta.page}
          totalPages={employees.data.meta.totalPages}
          onPageChange={(page) => update({ page })}
        />
      </>
    );
  };

  const total = employees.data?.meta.totalItems;
  return (
    <div className="page employees-page">
      <div className="page__header">
        <h1 className="page__title">Employees</h1>
        <Button ref={newEmployeeButton} onClick={onCreate}>New employee</Button>
      </div>
      <EmployeeFilters
        state={state}
        departments={departments.data ?? []}
        departmentsFailed={departments.isError}
        onChange={update}
      />
      <p className="employees-page__count" aria-live="polite">
        {total === undefined ? '' : `${total} ${total === 1 ? 'employee' : 'employees'}`}
      </p>
      {renderBody()}
      <EmployeeDeleteDialog
        employee={deleting}
        onClose={() => {
          setDeleting(null);
          focusAfterDelete.current = null;
        }}
        onDeleted={() => setDeleting(null)}
      />
      <EmployeeDrawer target={drawer} onClose={closeDrawer} />
      <PayslipDrawer target={payslip} onClose={closePayslip} />
    </div>
  );
}
