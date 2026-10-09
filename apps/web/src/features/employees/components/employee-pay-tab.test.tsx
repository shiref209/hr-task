import { ProblemType, type PayItems, type TaxTable } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
import {
  fetchPayItems,
  fetchTaxTables,
  replacePayItems,
} from '../../payroll/api/payroll-api';
import {
  createEmployee,
  fetchDepartments,
  fetchEmployee,
  fetchEmployees,
  restoreEmployee,
  updateEmployee,
  uploadProfileImage,
} from '../api/employees-api';
import { EmployeesPage } from '../pages/employees-page';
import { anEmployee, departments, pageOf } from '../test-utils';

// Session is mocked as a signed-in HR user (plain functions: survive vi.resetAllMocks).
vi.mock('../../auth/api/auth-api', async () => {
  const { anAuthUser } = await import('../../auth/test-utils');
  return {
    fetchMe: async () => anAuthUser('HR'),
    login: async () => anAuthUser('HR'),
    logout: async () => undefined,
    fetchMyTaxTable: async () => undefined,
  };
});

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
const detailMock = vi.mocked(fetchEmployee);
const updateMock = vi.mocked(updateEmployee);
const tablesMock = vi.mocked(fetchTaxTables);
const itemsMock = vi.mocked(fetchPayItems);
const replaceMock = vi.mocked(replacePayItems);

const STANDARD_ID = '33333333-3333-4333-8333-333333333333';
const SPECIAL_ID = '44444444-4444-4444-8444-444444444444';

const aTable = (id: string, name: string, isDefault: boolean): TaxTable => ({
  id,
  name,
  isDefault,
  brackets: [{ upTo: null, rate: '10.00' }],
  employeeCount: 0,
});
const tables = [aTable(STANDARD_ID, 'Standard', true), aTable(SPECIAL_ID, 'Special', false)];
const savedItems: PayItems = {
  allowances: [{ name: 'Transport', amount: '1500.00' }],
  deductions: [{ name: 'Loan', amount: '500.00' }],
};

const existing = anEmployee(1, { fullName: 'Ahmed Zaki' });

function renderPage() {
  window.history.replaceState(null, '', '/');
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

const apiError = (status: number, extra: Record<string, unknown> = {}) =>
  new ApiError({ type: ProblemType.businessRuleViolation, title: 'Problem', status, ...extra });

async function openEdit() {
  await screen.findByRole('table');
  await userEvent.click(screen.getByRole('button', { name: 'Actions for Ahmed Zaki' }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  const dialog = await screen.findByRole('dialog', { name: 'Edit Ahmed Zaki' });
  await within(dialog).findByDisplayValue('Ahmed Zaki');
  return dialog;
}

/** Opens Edit, switches to Pay and waits until tax tables and pay items have loaded. */
async function openPay() {
  const dialog = await openEdit();
  await userEvent.click(within(dialog).getByRole('tab', { name: 'Pay' }));
  await within(dialog).findByRole('option', { name: 'Special' });
  await within(dialog).findByDisplayValue('Transport');
  return dialog;
}

const taxSelect = (dialog: HTMLElement) => within(dialog).getByLabelText('Tax table');
const savePay = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Save pay' });
const label = (dialog: HTMLElement, text: string) => within(dialog).getByLabelText(text);

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchDepartments).mockResolvedValue(departments);
  vi.mocked(restoreEmployee).mockResolvedValue(existing);
  vi.mocked(createEmployee).mockResolvedValue(existing);
  vi.mocked(uploadProfileImage).mockResolvedValue(existing);
  listMock.mockResolvedValue(pageOf([existing]));
  detailMock.mockResolvedValue(existing);
  updateMock.mockResolvedValue(existing);
  tablesMock.mockResolvedValue(tables);
  itemsMock.mockResolvedValue(savedItems);
  replaceMock.mockResolvedValue(savedItems);
});

describe('Pay tab - tabs (edge case 14)', () => {
  it('the edit drawer has the tabs Details and Pay, Details selected first', async () => {
    renderPage();
    const dialog = await openEdit();

    expect(within(dialog).getByRole('tab', { name: 'Details' })).toHaveAttribute('aria-selected', 'true');
    expect(within(dialog).getByRole('tab', { name: 'Pay' })).toHaveAttribute('aria-selected', 'false');
  });

  it('the create drawer has no tabs', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: /new employee/i }));

    const dialog = screen.getByRole('dialog', { name: 'New employee' });
    expect(within(dialog).queryByRole('tab')).not.toBeInTheDocument();
  });
});

describe('Pay tab - tax table select (edge case 14)', () => {
  it('lists "Default (<default name>)" first, then every table', async () => {
    renderPage();
    const dialog = await openPay();

    const options = within(taxSelect(dialog)).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Default (Standard)', 'Standard', 'Special']);
  });

  it('preselects Default when the employee has no tax table', async () => {
    renderPage();
    const dialog = await openPay();

    expect(taxSelect(dialog)).toHaveDisplayValue('Default (Standard)');
  });

  it('preselects the employee tax table', async () => {
    detailMock.mockResolvedValue({ ...existing, taxTable: { id: SPECIAL_ID, name: 'Special' } });
    renderPage();
    const dialog = await openPay();

    expect(taxSelect(dialog)).toHaveDisplayValue('Special');
  });

  it('sends taxTableId for a chosen table and no pay items when only the table changed', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Special');

    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[0]).toBe(existing.id);
    expect(updateMock.mock.calls[0]?.[1]).toEqual({ taxTableId: SPECIAL_ID });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('sends taxTableId null when switching back to Default', async () => {
    detailMock.mockResolvedValue({ ...existing, taxTable: { id: SPECIAL_ID, name: 'Special' } });
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Default (Standard)');

    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[1]).toEqual({ taxTableId: null });
  });
});

describe('Pay tab - pay item rows (edge case 15)', () => {
  it('shows the saved allowances and deductions as name + amount rows', async () => {
    renderPage();
    const dialog = await openPay();

    expect(label(dialog, 'Allowance name 1')).toHaveValue('Transport');
    expect((label(dialog, 'Allowance amount 1') as HTMLInputElement).value).toMatch(/^1,?500\.00$/);
    expect(label(dialog, 'Deduction name 1')).toHaveValue('Loan');
    expect((label(dialog, 'Deduction amount 1') as HTMLInputElement).value).toBe('500.00');
  });

  it('adds an allowance and a deduction row and sends them normalised, in order', async () => {
    itemsMock.mockResolvedValue({ allowances: [], deductions: [] });
    renderPage();
    const dialog = await openEdit();
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Pay' }));
    await within(dialog).findByRole('option', { name: 'Special' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add allowance' }));
    await userEvent.type(label(dialog, 'Allowance name 1'), 'Housing');
    await userEvent.type(label(dialog, 'Allowance amount 1'), '3,000.5');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add deduction' }));
    await userEvent.type(label(dialog, 'Deduction name 1'), 'Fine');
    await userEvent.type(label(dialog, 'Deduction amount 1'), '75');
    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledOnce());
    expect(replaceMock.mock.calls[0]?.[0]).toBe(existing.id);
    expect(replaceMock.mock.calls[0]?.[1]).toEqual({
      allowances: [{ name: 'Housing', amount: '3000.50' }],
      deductions: [{ name: 'Fine', amount: '75.00' }],
    });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows duplicate names and any number of rows, keeping their order', async () => {
    itemsMock.mockResolvedValue({ allowances: [], deductions: [] });
    renderPage();
    const dialog = await openEdit();
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Pay' }));
    await within(dialog).findByRole('option', { name: 'Special' });

    for (const [i, amount] of ['100', '200', '300'].entries()) {
      await userEvent.click(within(dialog).getByRole('button', { name: 'Add allowance' }));
      await userEvent.type(label(dialog, `Allowance name ${i + 1}`), 'Bonus');
      await userEvent.type(label(dialog, `Allowance amount ${i + 1}`), amount);
    }
    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledOnce());
    expect(replaceMock.mock.calls[0]?.[1]).toEqual({
      allowances: [
        { name: 'Bonus', amount: '100.00' },
        { name: 'Bonus', amount: '200.00' },
        { name: 'Bonus', amount: '300.00' },
      ],
      deductions: [],
    });
  });

  it('removes a row by its button', async () => {
    itemsMock.mockResolvedValue({
      allowances: [
        { name: 'Transport', amount: '1500.00' },
        { name: 'Housing', amount: '3000.00' },
      ],
      deductions: [],
    });
    renderPage();
    const dialog = await openPay();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove allowance 1' }));
    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledOnce());
    expect(replaceMock.mock.calls[0]?.[1]).toEqual({
      allowances: [{ name: 'Housing', amount: '3000.00' }],
      deductions: [],
    });
  });

  it('allows saving an empty list', async () => {
    renderPage();
    const dialog = await openPay();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove allowance 1' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove deduction 1' }));
    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledOnce());
    expect(replaceMock.mock.calls[0]?.[1]).toEqual({ allowances: [], deductions: [] });
  });

  it('shows the schema message for an empty name and does not call the API', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add allowance' }));
    await userEvent.type(label(dialog, 'Allowance amount 2'), '10');

    await userEvent.click(savePay(dialog));

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe('Pay tab - Save pay (edge case 16)', () => {
  it('disables Save pay while nothing changed and again after a change is reverted', async () => {
    renderPage();
    const dialog = await openPay();
    expect(savePay(dialog)).toBeDisabled();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add allowance' }));
    expect(savePay(dialog)).toBeEnabled();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove allowance 2' }));
    expect(savePay(dialog)).toBeDisabled();
  });

  it('calls only replacePayItems when only the items changed', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.type(label(dialog, 'Deduction name 1'), '!');

    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledOnce());
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('saves both parts, toasts "Pay saved", closes and refetches the list', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Special');
    await userEvent.type(label(dialog, 'Allowance name 1'), 'x');
    const listCalls = listMock.mock.calls.length;

    await userEvent.click(savePay(dialog));

    expect(await screen.findByText('Pay saved')).toBeInTheDocument();
    expect(updateMock).toHaveBeenCalledOnce();
    expect(replaceMock).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
  });

  it('keeps the saved tax table and shows the error when the items fail; a retry sends only the items', async () => {
    replaceMock.mockRejectedValueOnce(apiError(500, { detail: 'Pay items unavailable' }));
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Special');
    await userEvent.type(label(dialog, 'Allowance name 1'), 'x');

    await userEvent.click(savePay(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Pay items unavailable');
    expect(dialog).toBeInTheDocument();
    expect(taxSelect(dialog)).toHaveDisplayValue('Special');
    expect(label(dialog, 'Allowance name 1')).toHaveValue('Transportx');
    expect(screen.queryByText('Pay saved')).not.toBeInTheDocument();

    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledTimes(2));
    expect(updateMock).toHaveBeenCalledOnce();
    expect(await screen.findByText('Pay saved')).toBeInTheDocument();
  });

  it('keeps the saved items and shows the error when the tax table fails; a retry sends only the table', async () => {
    updateMock.mockRejectedValueOnce(apiError(422, { detail: 'Tax table cannot be changed' }));
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Special');
    await userEvent.type(label(dialog, 'Allowance name 1'), 'x');

    await userEvent.click(savePay(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Tax table cannot be changed');
    expect(dialog).toBeInTheDocument();
    expect(taxSelect(dialog)).toHaveDisplayValue('Special');
    expect(label(dialog, 'Allowance name 1')).toHaveValue('Transportx');

    await userEvent.click(savePay(dialog));

    await waitFor(() => expect(updateMock).toHaveBeenCalledTimes(2));
    expect(replaceMock).toHaveBeenCalledOnce();
    expect(await screen.findByText('Pay saved')).toBeInTheDocument();
  });
});

describe('Pay tab - tabs keep input and guard closing (edge case 17)', () => {
  const confirm = () => screen.getByRole('dialog', { name: 'Discard unsaved changes?' });

  it('keeps unsaved Pay input when switching to Details and back', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Special');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add deduction' }));
    await userEvent.type(label(dialog, 'Deduction name 2'), 'Fine');

    await userEvent.click(within(dialog).getByRole('tab', { name: 'Details' }));
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Pay' }));

    expect(taxSelect(dialog)).toHaveDisplayValue('Special');
    expect(label(dialog, 'Deduction name 2')).toHaveValue('Fine');
  });

  it('keeps unsaved Details input when visiting Pay and coming back', async () => {
    renderPage();
    const dialog = await openEdit();
    await userEvent.type(within(dialog).getByLabelText(/^Job title/), 'x');

    await userEvent.click(within(dialog).getByRole('tab', { name: 'Pay' }));
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Details' }));

    expect(within(dialog).getByLabelText(/^Job title/)).toHaveValue('Ops Leadx');
  });

  it('asks before discarding when the Pay tab is dirty', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add allowance' }));

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(confirm()).toBeInTheDocument();
  });

  it('asks before discarding when only Details is dirty and the Pay tab is showing', async () => {
    renderPage();
    const dialog = await openEdit();
    await userEvent.type(within(dialog).getByLabelText(/^Job title/), 'x');
    await userEvent.click(within(dialog).getByRole('tab', { name: 'Pay' }));
    await within(dialog).findByRole('option', { name: 'Special' });

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(confirm()).toBeInTheDocument();
  });

  it('asks when closing with Esc on a dirty Pay tab, and Discard closes', async () => {
    renderPage();
    const dialog = await openPay();
    await userEvent.selectOptions(taxSelect(dialog), 'Special');

    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    await userEvent.click(within(confirm()).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('closes without asking when neither tab is dirty', async () => {
    renderPage();
    const dialog = await openPay();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
