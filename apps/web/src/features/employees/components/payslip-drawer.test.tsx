import { ProblemType, type Payslip } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
import { fetchPayslip } from '../../payroll/api/payroll-api';
import { fetchDepartments, fetchEmployees, restoreEmployee } from '../api/employees-api';
import { EmployeesPage } from '../pages/employees-page';
import { anEmployee, departments, pageOf } from '../test-utils';

vi.mock('../api/employees-api', () => ({
  fetchEmployees: vi.fn(),
  fetchDepartments: vi.fn(),
  restoreEmployee: vi.fn(),
  fetchEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  uploadProfileImage: vi.fn(),
}));

vi.mock('../../payroll/api/payroll-api', () => ({
  fetchTaxTables: vi.fn(),
  createTaxTable: vi.fn(),
  updateTaxTable: vi.fn(),
  setDefaultTaxTable: vi.fn(),
  deleteTaxTable: vi.fn(),
  fetchSocialInsurance: vi.fn(),
  updateSocialInsurance: vi.fn(),
  fetchPayItems: vi.fn(),
  replacePayItems: vi.fn(),
  fetchPayslip: vi.fn(),
}));

const listMock = vi.mocked(fetchEmployees);
const payslipMock = vi.mocked(fetchPayslip);

const omar = anEmployee(1, { fullName: 'Omar Farouk' });

/** The 25,000 worked example of specs/payroll/spec.md (default table, insurance 11% capped at 2,000). */
function aPayslip(overrides: Partial<Payslip> = {}): Payslip {
  return {
    employee: { id: omar.id, fullName: 'Omar Farouk' },
    month: '2026-10',
    taxTable: { id: '33333333-3333-4333-8333-333333333333', name: 'Standard' },
    baseSalary: '25000.00',
    allowances: [{ name: 'Transport', amount: '1500.00' }],
    allowancesTotal: '1500.00',
    gross: '26500.00',
    tax: {
      total: '1750.00',
      effectiveRate: '7.00',
      brackets: [
        { from: '0.00', upTo: '10000.00', rate: '0.00', taxable: '10000.00', tax: '0.00' },
        { from: '10000.00', upTo: '20000.00', rate: '10.00', taxable: '10000.00', tax: '1000.00' },
        { from: '20000.00', upTo: null, rate: '15.00', taxable: '5000.00', tax: '750.00' },
      ],
    },
    socialInsurance: { rate: '11.00', cap: '2000.00', amount: '2000.00', capped: true },
    deductions: [{ name: 'Loan', requested: '500.00', applied: '500.00' }],
    deductionsApplied: '500.00',
    deductionsUnapplied: '0.00',
    net: '22250.00',
    warnings: [],
    ...overrides,
  };
}

function renderPage(url = '/') {
  window.history.replaceState(null, '', url);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <EmployeesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const apiError = (status: number, detail: string) =>
  new ApiError({
    type: status === 404 ? ProblemType.notFound : ProblemType.businessRuleViolation,
    title: 'Problem',
    status,
    detail,
  });

async function openMenu() {
  await screen.findByRole('table');
  await userEvent.click(screen.getByRole('button', { name: 'Actions for Omar Farouk' }));
}

async function openPayslip() {
  await openMenu();
  await userEvent.click(screen.getByRole('menuitem', { name: 'Payslip' }));
  return screen.findByRole('dialog', { name: 'Payslip — Omar Farouk' });
}

/**
 * Contract: a payslip line is a row element holding a label element and an amount element,
 * so the amount is found in the label element's parent.
 */
function line(dialog: HTMLElement, text: string | RegExp) {
  const row = within(dialog).getByText(text).parentElement;
  if (!row) throw new Error(`no row for ${String(text)}`);
  return row;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchDepartments).mockResolvedValue(departments);
  vi.mocked(restoreEmployee).mockResolvedValue(omar);
  listMock.mockResolvedValue(pageOf([omar]));
  payslipMock.mockResolvedValue(aPayslip());
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Payslip drawer - row menu (edge case 21)', () => {
  it('lists Edit, Payslip, Delete on active rows', async () => {
    renderPage();
    await openMenu();

    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Edit',
      'Payslip',
      'Delete',
    ]);
  });

  it('does not offer Payslip in the deleted view', async () => {
    listMock.mockResolvedValue(
      pageOf([{ ...omar, deletedAt: '2026-10-09T10:00:00.000Z' }]),
    );
    renderPage('/?deleted=true');
    await openMenu();

    expect(screen.queryByRole('menuitem', { name: 'Payslip' })).not.toBeInTheDocument();
  });
});

describe('Payslip drawer - opening and month (edge case 18)', () => {
  it('is titled "Payslip — <fullName>"', async () => {
    renderPage();
    const dialog = await openPayslip();

    expect(dialog).toBeInTheDocument();
  });

  it('defaults the month to the current local month and fetches it', async () => {
    vi.setSystemTime(new Date(2026, 9, 9, 23, 30, 0));
    renderPage();
    const dialog = await openPayslip();

    const month = within(dialog).getByLabelText('Month');
    expect(month).toHaveAttribute('type', 'month');
    expect(month).toHaveValue('2026-10');
    await waitFor(() => expect(payslipMock).toHaveBeenCalledWith(omar.id, '2026-10'));
  });

  it('refetches with the new month on change', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    fireEvent.change(within(dialog).getByLabelText('Month'), { target: { value: '2026-09' } });

    await waitFor(() => expect(payslipMock).toHaveBeenLastCalledWith(omar.id, '2026-09'));
  });

  it('keeps the previous payslip visible and marks the drawer busy while the next month loads', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');
    payslipMock.mockReturnValue(new Promise<Payslip>(() => undefined));

    fireEvent.change(within(dialog).getByLabelText('Month'), { target: { value: '2026-09' } });

    await waitFor(() => expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull());
    expect(within(dialog).getByText('Net')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Month')).toHaveValue('2026-09');
  });

  it('closes with the close button', async () => {
    renderPage();
    const dialog = await openPayslip();

    await userEvent.click(within(dialog).getByRole('button', { name: /close/i }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

describe('Payslip drawer - content (edge cases 18, 20)', () => {
  it('shows base, allowance, gross and net amounts', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, 'Base salary')).toHaveTextContent('25,000.00');
    expect(line(dialog, 'Transport')).toHaveTextContent('1,500.00');
    expect(line(dialog, 'Gross')).toHaveTextContent('26,500.00');
    expect(line(dialog, 'Net')).toHaveTextContent('22,250.00');
  });

  it('shows tax with the table name and effective percentage, and every bracket line', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, /^Tax \(Standard, 7(\.00)?%\)$/)).toHaveTextContent(/[-−]1,750\.00/);
    expect(line(dialog, /^0(\.00)? – 10,000\.00 @ 0(\.00)?%$/)).toHaveTextContent('0.00');
    expect(line(dialog, /^10,000\.00 – 20,000\.00 @ 10(\.00)?%$/)).toHaveTextContent('1,000.00');
    expect(line(dialog, /^above 20,000\.00 @ 15(\.00)?%$/)).toHaveTextContent('750.00');
  });

  it('shows social insurance with its rate and the capped note', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, /^Social insurance \(11(\.00)?%, capped\)$/)).toHaveTextContent(/[-−]2,000\.00/);
  });

  it('omits the capped note when the cap was not hit', async () => {
    payslipMock.mockResolvedValue(
      aPayslip({ socialInsurance: { rate: '11.00', cap: '2000.00', amount: '1100.00', capped: false } }),
    );
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, /^Social insurance \(11(\.00)?%\)$/)).toHaveTextContent(/[-−]1,100\.00/);
    expect(within(dialog).queryByText(/capped/)).not.toBeInTheDocument();
  });

  it('shows each deduction as a negative line', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, 'Loan')).toHaveTextContent(/[-−]500\.00/);
  });

  it('shows "requested → applied" for a partially applied deduction', async () => {
    payslipMock.mockResolvedValue(
      aPayslip({
        deductions: [{ name: 'Loan', requested: '6000.00', applied: '4450.00' }],
        deductionsApplied: '4450.00',
        deductionsUnapplied: '1550.00',
        net: '0.00',
      }),
    );
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, 'Loan')).toHaveTextContent('6,000.00 → 4,450.00');
  });

  it('shows a fully applied deduction without the arrow', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(line(dialog, 'Loan')).not.toHaveTextContent('→');
  });

  it('renders server warnings as an alert', async () => {
    payslipMock.mockResolvedValue(
      aPayslip({ warnings: ['1,550.00 of deductions could not be applied'] }),
    );
    renderPage();
    const dialog = await openPayslip();

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      '1,550.00 of deductions could not be applied',
    );
  });

  it('renders no alert when there are no warnings', async () => {
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText('Net');

    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('Payslip drawer - errors (edge case 19)', () => {
  it.each([
    'Not yet hired: hire date is 2026-11-01',
    'Employee is inactive',
  ])('shows the 422 "%s" inline in the drawer, not as a toast', async (detail) => {
    payslipMock.mockRejectedValue(apiError(422, detail));
    renderPage();
    const dialog = await openPayslip();

    expect(await within(dialog).findByText(detail)).toBeInTheDocument();
    expect(document.querySelector('.toast--error')).toBeNull();
    expect(within(dialog).getByLabelText('Month')).toBeInTheDocument();
  });

  it('lets HR pick another month after a 422', async () => {
    payslipMock.mockRejectedValueOnce(apiError(422, 'Not yet hired: hire date is 2026-11-01'));
    renderPage();
    const dialog = await openPayslip();
    await within(dialog).findByText(/Not yet hired/);

    fireEvent.change(within(dialog).getByLabelText('Month'), { target: { value: '2026-12' } });

    await within(dialog).findByText('Net');
    expect(within(dialog).queryByText(/Not yet hired/)).not.toBeInTheDocument();
  });

  it('on a 404 toasts, closes the drawer and refetches the list', async () => {
    payslipMock.mockRejectedValue(apiError(404, 'Employee not found'));
    renderPage();
    await openMenu();
    const listCalls = listMock.mock.calls.length;
    await userEvent.click(screen.getByRole('menuitem', { name: 'Payslip' }));

    expect(await screen.findByText('This employee no longer exists')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
  });
});
