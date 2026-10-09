import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../../../shared/ui';
import { fetchMe } from '../../auth/api/auth-api';
import { anAuthUser } from '../../auth/test-utils';
import { fetchDepartments, fetchEmployees } from '../api/employees-api';
import { anEmployee, departments, pageOf } from '../test-utils';
import { EmployeesPage } from './employees-page';

vi.mock('../../auth/api/auth-api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  fetchMyTaxTable: vi.fn(),
}));
vi.mock('../api/employees-api', () => ({
  fetchEmployees: vi.fn(),
  fetchDepartments: vi.fn(),
  restoreEmployee: vi.fn(),
  fetchEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  uploadProfileImage: vi.fn(),
}));

function renderPage() {
  window.history.replaceState(null, '', '/');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <EmployeesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

/** What an EMPLOYEE receives: no baseSalary / taxTable at all (EmployeeSummary). */
const summaryOf = (n: number) => {
  const { baseSalary: _salary, taxTable: _taxTable, ...summary } = anEmployee(n, {
    fullName: `Colleague ${n}`,
  });
  return summary;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchMe).mockResolvedValue(anAuthUser('EMPLOYEE'));
  vi.mocked(fetchDepartments).mockResolvedValue(departments);
  // The API never sends pay fields to an EMPLOYEE; the cast mirrors that wire shape.
  vi.mocked(fetchEmployees).mockResolvedValue(
    pageOf([summaryOf(1), summaryOf(2)] as unknown as ReturnType<typeof anEmployee>[]),
  );
});

describe('EmployeesPage as EMPLOYEE (edge case 23)', () => {
  it('lists colleagues with name, department and job title', async () => {
    renderPage();

    const row = await screen.findByRole('row', { name: /Colleague 1/ });
    expect(within(row).getByText('Operations')).toBeInTheDocument();
    expect(within(row).getByText('Ops Lead')).toBeInTheDocument();
  });

  it('has no Salary column header or salary cell', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Colleague 1/ });

    expect(screen.queryByRole('columnheader', { name: 'Salary' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).not.toContain('Salary');
    expect(screen.queryByText(/12,500|12500/)).not.toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument(); // formatting an absent salary
  });

  it('has no "New employee" button', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Colleague 1/ });

    expect(screen.queryByRole('button', { name: 'New employee' })).not.toBeInTheDocument();
  });

  it('has no row actions menu', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Colleague 1/ });

    expect(screen.queryByRole('button', { name: /Actions for/ })).not.toBeInTheDocument();
    expect(document.querySelector('[aria-haspopup="menu"]')).toBeNull();
  });

  it('has no "Show deleted" switch', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Colleague 1/ });

    expect(screen.queryByLabelText('Show deleted')).not.toBeInTheDocument();
  });

  it('never asks the API for deleted employees', async () => {
    renderPage();
    await screen.findByRole('row', { name: /Colleague 1/ });

    expect(vi.mocked(fetchEmployees).mock.calls.at(-1)?.[0]).toMatchObject({ deleted: false });
  });

  it('does not offer "New employee" in the empty state either', async () => {
    vi.mocked(fetchEmployees).mockResolvedValue(pageOf([]));
    renderPage();

    await screen.findByText('No employees yet');
    expect(screen.queryByRole('button', { name: 'New employee' })).not.toBeInTheDocument();
  });
});
