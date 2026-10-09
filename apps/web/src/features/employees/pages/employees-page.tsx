import type { Employee } from '@hr/types';
import { useEffect } from 'react';
import { Button, EmptyState, ErrorView, Pagination, Skeleton, useToast } from '../../../shared/ui';
import { toApiError } from '../../../shared/http/http-client';
import { useDebouncedValue } from '../../../shared/hooks/use-debounced-value';
import { useDepartments } from '../api/use-departments';
import { useEmployees } from '../api/use-employees';
import { useRestoreEmployee } from '../api/use-restore-employee';
import { EmployeeFilters } from '../components/employee-filters';
import { EmployeeList } from '../components/employee-list';
import { toListQuery } from '../list-state';
import { useEmployeeListState } from '../use-employee-list-state';
import '../employees.scss';

const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 5;

interface EmployeesPageProps {
  // TODO(form deep-dive): open the create drawer; a no-op until the drawer exists.
  onCreate?: () => void;
}

export function EmployeesPage({ onCreate = () => undefined }: EmployeesPageProps) {
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
        const { problem } = toApiError(error);
        toast.show({
          variant: 'error',
          title: 'Could not restore employee',
          description: problem.detail ?? problem.title,
        });
      },
    });

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
    <main className="employees-page">
      <h1 className="employees-page__title">Employees</h1>
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
    </main>
  );
}
