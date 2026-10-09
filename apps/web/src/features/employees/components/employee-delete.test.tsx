import type { Employee } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import {
  deleteEmployee,
  fetchDepartments,
  fetchEmployees,
  restoreEmployee,
} from '../api/employees-api';
import { EmployeesPage } from '../pages/employees-page';
import { anEmployee, departments, pageOf, problemError } from '../test-utils';

vi.mock('../api/employees-api', () => ({
  fetchEmployees: vi.fn(),
  fetchDepartments: vi.fn(),
  restoreEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
}));

const listMock = vi.mocked(fetchEmployees);
const departmentsMock = vi.mocked(fetchDepartments);
const deleteMock = vi.mocked(deleteEmployee);
const restoreMock = vi.mocked(restoreEmployee);

const HINT = "They'll be hidden from the list. You can restore them from Show deleted.";

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

const named = (n: number, fullName: string, overrides: Partial<Employee> = {}) =>
  anEmployee(n, { fullName, ...overrides });
const actionsOf = (name: string) =>
  screen.getByRole('button', { name: `Actions for ${name}` });
const dialog = () => screen.getByRole('dialog', { name: /^Delete .+\?$/ });
const confirmButton = () => within(dialog()).getByRole('button', { name: 'Delete' });

/** List fake that drops deleted ids, like the server does. */
function serveList(all: Employee[]) {
  const removed = new Set<string>();
  listMock.mockImplementation(async () =>
    pageOf(all.filter((e) => !removed.has(e.id))),
  );
  deleteMock.mockImplementation(async (id) => {
    removed.add(id);
  });
}

async function openDeleteDialog(name: string) {
  await screen.findByRole('table');
  await userEvent.click(actionsOf(name));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  await screen.findByRole('dialog');
}

const ahmed = named(1, 'Ahmed Zaki');
const mona = named(2, 'Mona Hassan');
const omar = named(3, 'Omar Said');

beforeEach(() => {
  vi.resetAllMocks();
  departmentsMock.mockResolvedValue(departments);
  listMock.mockResolvedValue(pageOf([ahmed, mona, omar]));
});

describe('Employee delete - row menu (edge case 1)', () => {
  it('lists Edit, Payslip, then Delete on active rows', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(actionsOf('Ahmed Zaki'));

    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Edit',
      'Payslip',
      'Delete',
    ]);
  });

  it('keeps only Restore on deleted rows', async () => {
    listMock.mockResolvedValue(
      pageOf([named(1, 'Ahmed Zaki', { deletedAt: '2026-10-09T10:00:00.000Z' })]),
    );
    renderPage('/?deleted=true');
    await screen.findByRole('table');
    await userEvent.click(actionsOf('Ahmed Zaki'));

    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Restore',
    ]);
    expect(restoreMock).not.toHaveBeenCalled();
  });
});

describe('Employee delete - dialog (edge case 2)', () => {
  it('opens a dialog titled "Delete <fullName>?" with the hidden-from-list text', async () => {
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    const el = screen.getByRole('dialog', { name: 'Delete Ahmed Zaki?' });
    expect(within(el).getByText(HINT)).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('offers Cancel and Delete, with initial focus on Cancel', async () => {
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(confirmButton()).toBeEnabled();
  });

  it('closes on Cancel without deleting', async () => {
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    await userEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });
});

describe('Employee delete - pending (edge case 3)', () => {
  it('shows Delete as busy, disables both buttons and ignores Esc', async () => {
    deleteMock.mockReturnValue(new Promise(() => undefined));
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    await userEvent.click(confirmButton());

    await waitFor(() => expect(confirmButton()).toHaveAttribute('aria-busy', 'true'));
    expect(confirmButton()).toBeDisabled();
    expect(within(dialog()).getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent(dialog(), new Event('cancel', { cancelable: true }));
    expect(screen.getByRole('dialog', { name: 'Delete Ahmed Zaki?' })).toBeInTheDocument();
    expect(deleteMock).toHaveBeenCalledTimes(1);
  });
});

describe('Employee delete - success (edge cases 4 and 5)', () => {
  it('deletes once, closes the dialog, toasts and refetches the list', async () => {
    serveList([ahmed, mona, omar]);
    renderPage();
    await openDeleteDialog('Mona Hassan');
    const callsBefore = listMock.mock.calls.length;

    await userEvent.click(confirmButton());

    expect(await screen.findByText('Mona Hassan deleted')).toBeInTheDocument();
    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith(mona.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
    await waitFor(() =>
      expect(screen.queryByRole('row', { name: /Mona Hassan/ })).not.toBeInTheDocument(),
    );
  });

  it("moves focus to the next row's actions button", async () => {
    serveList([ahmed, mona, omar]);
    renderPage();
    await openDeleteDialog('Mona Hassan');

    await userEvent.click(confirmButton());

    await waitFor(() => expect(actionsOf('Omar Said')).toHaveFocus());
  });

  it("moves focus to the previous row's actions button when deleting the last row", async () => {
    serveList([ahmed, mona, omar]);
    renderPage();
    await openDeleteDialog('Omar Said');

    await userEvent.click(confirmButton());

    await waitFor(() => expect(actionsOf('Mona Hassan')).toHaveFocus());
  });

  it('moves focus to "New employee" when the list becomes empty', async () => {
    serveList([ahmed]);
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    await userEvent.click(confirmButton());

    await screen.findByText('No employees yet');
    await waitFor(() =>
      expect(document.activeElement).toHaveAccessibleName(/new employee/i),
    );
  });

  it('requests the previous page when deleting the last row of page 2', async () => {
    let removed = false;
    const lastRow = named(21, 'Last Row');
    listMock.mockImplementation(async (query) => {
      if (query.page === 2) {
        return removed
          ? pageOf([], { page: 2, totalItems: 20, totalPages: 1 })
          : pageOf([lastRow], { page: 2, totalItems: 21, totalPages: 2 });
      }
      return pageOf([ahmed], { totalItems: removed ? 20 : 21, totalPages: removed ? 1 : 2 });
    });
    deleteMock.mockImplementation(async () => {
      removed = true;
    });
    renderPage('/?page=2');
    await openDeleteDialog('Last Row');

    await userEvent.click(confirmButton());

    await waitFor(() => expect(listMock.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1 }));
    expect(new URLSearchParams(window.location.search).has('page')).toBe(false);
    expect(await screen.findByText('Ahmed Zaki')).toBeInTheDocument();
  });
});

describe('Employee delete - last active HR, 422 (edge case 6)', () => {
  it('keeps the dialog open with the server detail, disables Delete and relabels Cancel as Close', async () => {
    deleteMock.mockRejectedValue(
      problemError(422, 'Unprocessable', 'Cannot delete the last active HR employee'),
    );
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    await userEvent.click(confirmButton());

    const alert = await within(dialog()).findByRole('alert');
    expect(alert).toHaveTextContent('Cannot delete the last active HR employee');
    expect(confirmButton()).toBeDisabled();
    expect(within(dialog()).queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Employee delete - already deleted, 404 (edge case 7)', () => {
  it('closes the dialog, toasts and refetches the list', async () => {
    deleteMock.mockRejectedValue(problemError(404, 'Not Found', 'Employee not found'));
    renderPage();
    await openDeleteDialog('Ahmed Zaki');
    const callsBefore = listMock.mock.calls.length;

    await userEvent.click(confirmButton());

    expect(await screen.findByText('This employee was already deleted')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});

describe('Employee delete - other errors (edge case 8)', () => {
  it('keeps the dialog open with an alert and lets HR retry', async () => {
    deleteMock.mockRejectedValueOnce(
      problemError(500, 'Server error', 'Database unavailable'),
    );
    renderPage();
    await openDeleteDialog('Ahmed Zaki');

    await userEvent.click(confirmButton());

    expect(await within(dialog()).findByRole('alert')).toBeInTheDocument();
    expect(confirmButton()).toBeEnabled();
    expect(deleteMock).toHaveBeenCalledTimes(1);

    deleteMock.mockResolvedValueOnce(undefined);
    await userEvent.click(confirmButton());

    await waitFor(() => expect(deleteMock).toHaveBeenCalledTimes(2));
    expect(deleteMock).toHaveBeenLastCalledWith(ahmed.id);
  });
});
