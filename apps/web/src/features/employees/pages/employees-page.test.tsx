import type { EmployeeListQuery } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import {
  fetchDepartments,
  fetchEmployees,
  restoreEmployee,
} from '../api/employees-api';
import {
  anEmployee,
  DEPARTMENT_IDS,
  departments,
  pageOf,
  problemError,
} from '../test-utils';
import { EmployeesPage } from './employees-page';

vi.mock('../api/employees-api', () => ({
  fetchEmployees: vi.fn(),
  fetchDepartments: vi.fn(),
  restoreEmployee: vi.fn(),
}));

const listMock = vi.mocked(fetchEmployees);
const departmentsMock = vi.mocked(fetchDepartments);
const restoreMock = vi.mocked(restoreEmployee);

const DELETED_AT = '2026-10-09T10:00:00.000Z';

function renderPage(url = '/') {
  window.history.replaceState(null, '', url);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <EmployeesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const lastQuery = (): EmployeeListQuery | undefined =>
  listMock.mock.calls.at(-1)?.[0];
const table = () => screen.getByRole('table');
const rowOf = (name: string | RegExp) =>
  within(table()).getByRole('row', { name });
const search = () => new URLSearchParams(window.location.search);

beforeEach(() => {
  vi.resetAllMocks();
  departmentsMock.mockResolvedValue(departments);
  listMock.mockResolvedValue(pageOf([anEmployee(1)]));
});

describe('EmployeesPage - loading and rows', () => {
  it('shows a busy skeleton, not rows or empty states, on first load', () => {
    listMock.mockReturnValue(new Promise(() => undefined));
    renderPage();

    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.queryByRole('row')).not.toBeInTheDocument();
    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
  });

  it('requests page 1 with page size 20 in the API order', async () => {
    renderPage();
    await screen.findByRole('table');

    expect(lastQuery()).toEqual({ page: 1, pageSize: 20, deleted: false });
  });

  it('renders name, email, department, job title, formatted salary and status in a row', async () => {
    listMock.mockResolvedValue(
      pageOf([
        anEmployee(1, {
          fullName: 'Ahmed Zaki',
          email: 'ahmed@example.com',
          jobTitle: 'Ops Lead',
          baseSalary: '12500',
          status: 'ACTIVE',
        }),
      ]),
    );
    renderPage();
    await screen.findByRole('table');

    const row = within(rowOf(/Ahmed Zaki/));
    expect(row.getByText('Ahmed Zaki')).toBeInTheDocument();
    expect(row.getByText('ahmed@example.com')).toBeInTheDocument();
    expect(row.getByText('Operations')).toBeInTheDocument();
    expect(row.getByText('Ops Lead')).toBeInTheDocument();
    expect(row.getByText('12,500.00')).toBeInTheDocument();
    expect(row.getByText('Active')).toBeInTheDocument();
  });

  it('shows an Inactive badge for inactive employees', async () => {
    listMock.mockResolvedValue(
      pageOf([anEmployee(1, { fullName: 'Omar Said', status: 'INACTIVE' })]),
    );
    renderPage();
    await screen.findByRole('table');

    expect(within(rowOf(/Omar Said/)).getByText('Inactive')).toBeInTheDocument();
  });

  it('marks HR employees with an HR badge and others without', async () => {
    listMock.mockResolvedValue(
      pageOf([
        anEmployee(1, { fullName: 'Mona Hassan', type: 'HR' }),
        anEmployee(2, { fullName: 'Omar Said', type: 'EMPLOYEE' }),
      ]),
    );
    renderPage();
    await screen.findByRole('table');

    expect(within(rowOf(/Mona Hassan/)).getByText('HR')).toBeInTheDocument();
    expect(within(rowOf(/Omar Said/)).queryByText('HR')).not.toBeInTheDocument();
  });

  it('renders a real table with a caption naming it', async () => {
    renderPage();
    const el = await screen.findByRole('table');

    expect(el).toHaveAccessibleName(/employees/i);
    expect(el.querySelector('caption')).not.toBeNull();
  });

  it('announces the result count politely', async () => {
    listMock.mockResolvedValue(
      pageOf([anEmployee(1)], { totalItems: 15, totalPages: 1 }),
    );
    renderPage();

    const count = await screen.findByText('15 employees');
    expect(
      count.closest('[aria-live="polite"], [role="status"]'),
    ).not.toBeNull();
  });
});

describe('EmployeesPage - search', () => {
  it('trims the search, waits 300 ms and never queries intermediate keystrokes', async () => {
    renderPage();
    await screen.findByRole('table');
    const input = screen.getByRole('textbox', { name: /search/i });
    expect(input).toHaveAttribute('maxlength', '100');
    listMock.mockClear();

    await userEvent.type(input, '  ann  ');
    expect(listMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.any(String) }),
    );

    await waitFor(() => expect(lastQuery()?.search).toBe('ann'), {
      timeout: 2000,
    });
    for (const [query] of listMock.mock.calls) {
      expect(['ann', undefined]).toContain(query.search);
    }
  });

  it('resets to page 1 when the search changes', async () => {
    listMock.mockResolvedValue(
      pageOf([anEmployee(1)], { page: 2, totalItems: 30, totalPages: 2 }),
    );
    renderPage('/?page=2');
    await screen.findByRole('table');

    await userEvent.type(screen.getByRole('textbox', { name: /search/i }), 'a');

    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, search: 'a' }));
    expect(search().has('page')).toBe(false);
    expect(search().get('search')).toBe('a');
  });

  it('sends no search param once the box is cleared', async () => {
    renderPage('/?search=ann');
    await screen.findByRole('table');

    await userEvent.clear(screen.getByRole('textbox', { name: /search/i }));

    await waitFor(() => expect(lastQuery()?.search).toBeUndefined());
    expect(search().has('search')).toBe(false);
  });
});

describe('EmployeesPage - filters', () => {
  it('filters by department and resets to page 1', async () => {
    renderPage('/?page=2');
    await screen.findByRole('table');

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Department' }),
      DEPARTMENT_IDS.finance,
    );

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({
        departmentId: DEPARTMENT_IDS.finance,
        page: 1,
      }),
    );
    expect(search().get('departmentId')).toBe(DEPARTMENT_IDS.finance);
    expect(search().has('page')).toBe(false);
  });

  it('filters by status and resets to page 1', async () => {
    renderPage('/?page=2');
    await screen.findByRole('table');

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Status' }),
      'INACTIVE',
    );

    await waitFor(() =>
      expect(lastQuery()).toMatchObject({ status: 'INACTIVE', page: 1 }),
    );
    expect(search().get('status')).toBe('INACTIVE');
    expect(search().has('page')).toBe(false);
  });

  it('lists the loaded departments in the department filter', async () => {
    renderPage();
    await screen.findByRole('table');

    const select = screen.getByRole('combobox', { name: 'Department' });
    await waitFor(() =>
      expect(
        within(select).getByRole('option', { name: 'Finance' }),
      ).toBeInTheDocument(),
    );
  });

  it('switches to deleted=true keeping search and filters, back on page 1', async () => {
    renderPage(`/?search=ann&status=ACTIVE&departmentId=${DEPARTMENT_IDS.finance}&page=2`);
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('checkbox', { name: 'Show deleted' }));

    await waitFor(() =>
      expect(lastQuery()).toEqual({
        search: 'ann',
        status: 'ACTIVE',
        departmentId: DEPARTMENT_IDS.finance,
        deleted: true,
        page: 1,
        pageSize: 20,
      }),
    );
    expect(search().get('deleted')).toBe('true');
    expect(search().get('search')).toBe('ann');
  });
});

describe('EmployeesPage - deleted view and restore', () => {
  const deletedEmployee = anEmployee(1, {
    fullName: 'Omar Said',
    deletedAt: DELETED_AT,
  });

  async function openRestoreMenu() {
    await screen.findByRole('table');
    await userEvent.click(
      within(rowOf(/Omar Said/)).getByRole('button', { name: /actions/i }),
    );
  }

  it('shows "Deleted on 9 Oct 2026" on deleted rows', async () => {
    listMock.mockResolvedValue(pageOf([deletedEmployee]));
    renderPage('/?deleted=true');
    await screen.findByRole('table');

    expect(
      within(rowOf(/Omar Said/)).getByText('Deleted on 9 Oct 2026'),
    ).toBeInTheDocument();
  });

  it('offers only Restore in the row menu of the deleted view', async () => {
    listMock.mockResolvedValue(pageOf([deletedEmployee]));
    renderPage('/?deleted=true');
    await openRestoreMenu();

    const items = screen.getAllByRole('menuitem');
    expect(items.map((i) => i.textContent)).toEqual(['Restore']);
  });

  it('restores, shows a success toast and refetches the list', async () => {
    let restored = false;
    listMock.mockImplementation(async () =>
      pageOf(restored ? [] : [deletedEmployee]),
    );
    restoreMock.mockImplementation(async () => {
      restored = true;
      return { ...deletedEmployee, deletedAt: null };
    });
    renderPage('/?deleted=true');
    await openRestoreMenu();
    const callsBefore = listMock.mock.calls.length;

    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore' }));

    expect(restoreMock).toHaveBeenCalledWith(deletedEmployee.id);
    expect(await screen.findByText(/restored/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    await waitFor(() =>
      expect(screen.queryByText('Omar Said')).not.toBeInTheDocument(),
    );
  });

  it('shows the server detail in an error toast and refetches when restore conflicts', async () => {
    listMock.mockResolvedValue(pageOf([deletedEmployee]));
    restoreMock.mockRejectedValue(
      problemError(409, 'Conflict', 'Employee is not deleted'),
    );
    renderPage('/?deleted=true');
    await openRestoreMenu();
    const callsBefore = listMock.mock.calls.length;

    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore' }));

    expect(await screen.findByText('Employee is not deleted')).toBeInTheDocument();
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('moves to the previous page when restoring the last row of page 2', async () => {
    const lastRow = anEmployee(21, { fullName: 'Last Row', deletedAt: DELETED_AT });
    let restored = false;
    listMock.mockImplementation(async (query) => {
      if (query.page === 2) {
        return restored
          ? pageOf([], { page: 2, totalItems: 20, totalPages: 1 })
          : pageOf([lastRow], { page: 2, totalItems: 21, totalPages: 2 });
      }
      return pageOf([anEmployee(1, { fullName: 'First Row', deletedAt: DELETED_AT })], {
        totalItems: restored ? 20 : 21,
        totalPages: restored ? 1 : 2,
      });
    });
    restoreMock.mockImplementation(async () => {
      restored = true;
      return { ...lastRow, deletedAt: null };
    });
    renderPage('/?deleted=true&page=2');
    await screen.findByRole('table');
    await userEvent.click(
      within(rowOf(/Last Row/)).getByRole('button', { name: /actions/i }),
    );

    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore' }));

    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1 }));
    expect(search().has('page')).toBe(false);
    expect(await screen.findByText('First Row')).toBeInTheDocument();
  });
});

describe('EmployeesPage - empty states', () => {
  it('shows "No employees yet" with a New employee action when nothing exists', async () => {
    listMock.mockResolvedValue(pageOf([]));
    renderPage();

    expect(await screen.findByText('No employees yet')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /new employee/i }),
    ).toBeInTheDocument();
  });

  it('shows "No employees match your filters" and Clear filters resets everything', async () => {
    listMock.mockImplementation(async (query) =>
      query.search || query.status ? pageOf([]) : pageOf([anEmployee(1)]),
    );
    renderPage('/?search=zzz&status=INACTIVE');

    expect(
      await screen.findByText('No employees match your filters'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await screen.findByRole('table');
    expect(lastQuery()).toEqual({ page: 1, pageSize: 20, deleted: false });
    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('');
    expect(window.location.search).toBe('');
  });

  it('shows "No deleted employees" in an empty deleted view', async () => {
    listMock.mockResolvedValue(pageOf([]));
    renderPage('/?deleted=true');

    expect(await screen.findByText('No deleted employees')).toBeInTheDocument();
    expect(screen.queryByText('No employees yet')).not.toBeInTheDocument();
  });
});

describe('EmployeesPage - errors', () => {
  it('shows an inline error with Retry, keeps filters usable, and Retry refetches', async () => {
    listMock.mockRejectedValueOnce(
      problemError(500, 'Server error', 'Database unavailable'),
    );
    renderPage();

    const retry = await screen.findByRole('button', { name: 'Retry' });
    expect(screen.getByRole('textbox', { name: /search/i })).toBeEnabled();
    expect(screen.getByRole('combobox', { name: 'Status' })).toBeEnabled();

    await userEvent.click(retry);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it('disables the department filter with a hint when departments fail, list still renders', async () => {
    departmentsMock.mockRejectedValue(
      problemError(500, 'Server error', 'Departments down'),
    );
    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Department' });
    await waitFor(() => expect(select).toBeDisabled());
    expect(select).toHaveAccessibleDescription(/.+/);
  });
});

describe('EmployeesPage - pagination and URL', () => {
  const twoPages = (page: number) =>
    pageOf([anEmployee(page)], { page, totalItems: 40, totalPages: 2 });

  it('goes to the next and previous page', async () => {
    listMock.mockImplementation(async (query) => twoPages(query.page));
    renderPage();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(2));
    expect(search().get('page')).toBe('2');

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() => expect(lastQuery()?.page).toBe(1));
    expect(search().has('page')).toBe(false);
  });

  it('keeps the previous rows visible and the table busy while the next page loads', async () => {
    listMock.mockImplementation(async (query) =>
      query.page === 1
        ? twoPages(1)
        : new Promise<ReturnType<typeof twoPages>>(() => undefined),
    );
    renderPage();
    await screen.findByRole('table');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(table()).toHaveAttribute('aria-busy', 'true'));
    expect(screen.getByText('Employee 1')).toBeInTheDocument();
  });

  it('honours the initial URL state in the controls and the first request', async () => {
    listMock.mockResolvedValue(
      pageOf([anEmployee(1)], { page: 2, totalItems: 40, totalPages: 2 }),
    );
    renderPage(
      `/?search=ann&status=INACTIVE&departmentId=${DEPARTMENT_IDS.finance}&deleted=true&page=2`,
    );
    await screen.findByRole('table');

    expect(screen.getByRole('textbox', { name: /search/i })).toHaveValue('ann');
    expect(screen.getByRole('combobox', { name: 'Status' })).toHaveValue('INACTIVE');
    expect(screen.getByRole('checkbox', { name: 'Show deleted' })).toBeChecked();
    expect(listMock.mock.calls[0]?.[0]).toEqual({
      search: 'ann',
      status: 'INACTIVE',
      departmentId: DEPARTMENT_IDS.finance,
      deleted: true,
      page: 2,
      pageSize: 20,
    });
  });

  it('falls back to defaults for an invalid URL', async () => {
    renderPage('/?page=-3&status=BOGUS&departmentId=nope');
    await screen.findByRole('table');

    expect(listMock.mock.calls[0]?.[0]).toEqual({ page: 1, pageSize: 20, deleted: false });
  });

  it('leaves a clean URL in the default view', async () => {
    renderPage();
    await screen.findByRole('table');

    expect(window.location.search).toBe('');
  });
});
