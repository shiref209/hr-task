import { currentMonth, ProblemType, type AppliedTaxTable, type Payslip } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
import { fetchMe, fetchMyTaxTable } from '../../auth/api/auth-api';
import { anAuthUser } from '../../auth/test-utils';
import { fetchPayslip } from '../../payroll/api/payroll-api';
import { MyPayPage } from './my-pay-page';

// Assumed: MyPayPage is a named export of ./my-pay-page; fetchMyTaxTable() -> AppliedTaxTable.
vi.mock('../../auth/api/auth-api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  fetchMyTaxTable: vi.fn(),
}));
vi.mock('../../payroll/api/payroll-api', () => ({
  fetchPayslip: vi.fn(),
  fetchPayItems: vi.fn(),
  fetchTaxTables: vi.fn(),
  fetchSocialInsurance: vi.fn(),
}));

const me = anAuthUser('EMPLOYEE');
const payslipMock = vi.mocked(fetchPayslip);
const taxTableMock = vi.mocked(fetchMyTaxTable);

function aPayslip(): Payslip {
  return {
    employee: me.employee,
    month: currentMonth(),
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
        { from: '10000.00', upTo: null, rate: '15.00', taxable: '16500.00', tax: '1750.00' },
      ],
    },
    socialInsurance: { rate: '11.00', cap: '2000.00', amount: '2000.00', capped: true },
    deductions: [],
    deductionsApplied: '0.00',
    deductionsUnapplied: '0.00',
    net: '22750.00',
    warnings: [],
  };
}

const appliedTable: AppliedTaxTable = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Executive',
  isDefault: false,
  brackets: [
    { upTo: '30000.00', rate: '5.00' },
    { upTo: null, rate: '12.50' },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MyPayPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchMe).mockResolvedValue(me);
  payslipMock.mockResolvedValue(aPayslip());
  taxTableMock.mockResolvedValue(appliedTable);
});

describe('MyPayPage', () => {
  it('has a "My pay" heading', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'My pay', level: 1 })).toBeInTheDocument();
  });

  it('loads the payslip of the signed-in employee for the current month', async () => {
    renderPage();

    await screen.findByText('Net');
    expect(payslipMock).toHaveBeenCalledWith(me.employee.id, currentMonth());
  });

  it('renders the payslip figures with the shared payslip view', async () => {
    renderPage();

    expect(await screen.findByText('Base salary')).toBeInTheDocument();
    expect(screen.getByText('Transport')).toBeInTheDocument();
    expect(screen.getByText('Net')).toBeInTheDocument();
  });

  it('offers a month picker defaulting to the current month', async () => {
    renderPage();

    expect(await screen.findByLabelText('Month')).toHaveValue(currentMonth());
  });

  it('shows "Your tax table" with the applied brackets', async () => {
    renderPage();

    const section = (await screen.findByRole('heading', { name: 'Your tax table' })).closest(
      'section, article, div',
    );
    expect(section).not.toBeNull();
    expect(within(section as HTMLElement).getByText(/Executive/)).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText(/up to 30,000\.00 · 5%/)).toBeInTheDocument();
    expect(within(section as HTMLElement).getByText(/above · 12\.5%/)).toBeInTheDocument();
  });

  it('never shows other employees count on the tax table', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Your tax table' });

    expect(screen.queryByText(/Used by/)).not.toBeInTheDocument();
  });

  it('shows the 422 detail inline as a status message, like the payslip drawer', async () => {
    payslipMock.mockRejectedValue(
      new ApiError({
        type: ProblemType.businessRuleViolation,
        title: 'Business rule violation',
        status: 422,
        detail: 'No payslip before the hire date',
      }),
    );
    renderPage();

    expect(await screen.findByText('No payslip before the hire date')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('shows an error with Retry for other payslip failures', async () => {
    payslipMock.mockRejectedValue(
      new ApiError({ type: 'about:blank', title: 'Network error', status: 0 }),
    );
    renderPage();

    expect(await screen.findByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
