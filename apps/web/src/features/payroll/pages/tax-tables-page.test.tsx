import { ProblemType } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
import { problemError } from '../../employees/test-utils';
import {
  createTaxTable,
  deleteTaxTable,
  fetchTaxTables,
  setDefaultTaxTable,
  updateTaxTable,
} from '../api/payroll-api';
import { aTaxTable } from '../test-utils';
import { TaxTablesPage } from './tax-tables-page';

vi.mock('../api/payroll-api', () => ({
  fetchTaxTables: vi.fn(),
  createTaxTable: vi.fn(),
  updateTaxTable: vi.fn(),
  setDefaultTaxTable: vi.fn(),
  deleteTaxTable: vi.fn(),
}));

const listMock = vi.mocked(fetchTaxTables);
const createMock = vi.mocked(createTaxTable);
const updateMock = vi.mocked(updateTaxTable);
const setDefaultMock = vi.mocked(setDefaultTaxTable);
const deleteMock = vi.mocked(deleteTaxTable);

const standard = aTaxTable(1, {
  name: 'Standard',
  isDefault: true,
  employeeCount: 12,
  brackets: [
    { upTo: '10000.00', rate: '0.00' },
    { upTo: '20000.00', rate: '10.00' },
    { upTo: null, rate: '15.00' },
  ],
});
const flat = aTaxTable(2, {
  name: 'Flat',
  employeeCount: 1,
  brackets: [{ upTo: null, rate: '10.50' }],
});

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TaxTablesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const apiError = (status: number, extra: Record<string, unknown> = {}) =>
  new ApiError({ type: ProblemType.validationError, title: 'Problem', status, ...extra });

const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** Matches a label ignoring the trailing required-asterisk. */
const label = (text: string) => new RegExp(`^${escapeRe(text)}(\\s\\*)?$`);
const cardOf = (name: string) => {
  const card = screen.getByRole('heading', { name, level: 2 }).closest('article');
  if (!card) throw new Error(`No card for ${name}`);
  return card;
};
const actionsOf = (name: string) => screen.getByRole('button', { name: `Actions for ${name}` });
const drawer = (name: string) => screen.getByRole('dialog', { name });
const nameField = (dialog: HTMLElement) => within(dialog).getByLabelText(label('Name'));
const bracket = (dialog: HTMLElement, n: number) =>
  within(dialog).getByRole('group', { name: new RegExp(`^Bracket ${n}:`) });
const upTo = (dialog: HTMLElement, n: number) => within(bracket(dialog, n)).getByLabelText(label('Up to amount'));
const rate = (dialog: HTMLElement, n: number) => within(bracket(dialog, n)).getByLabelText(label('Tax rate %'));
const hasUpTo = (dialog: HTMLElement, n: number) =>
  within(bracket(dialog, n)).queryByLabelText(label('Up to amount')) !== null;
const save = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Save' });

async function openMenuItem(tableName: string, item: string) {
  await userEvent.click(actionsOf(tableName));
  await userEvent.click(screen.getByRole('menuitem', { name: item }));
}

async function openNew() {
  await screen.findByRole('heading', { name: 'Standard', level: 2 });
  await userEvent.click(screen.getByRole('button', { name: 'New table' }));
  return drawer('New tax table');
}

async function openEdit(name = 'Standard') {
  await screen.findByRole('heading', { name, level: 2 });
  await openMenuItem(name, 'Edit');
  return drawer(`Edit ${name}`);
}

beforeEach(() => {
  vi.resetAllMocks();
  listMock.mockResolvedValue([flat, standard]);
  createMock.mockResolvedValue(flat);
  updateMock.mockResolvedValue(standard);
  setDefaultMock.mockResolvedValue(flat);
  deleteMock.mockResolvedValue(undefined);
});

describe('Tax tables page - list (edge case 3)', () => {
  it('has a "Tax tables" heading and a "New table" button', async () => {
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Tax tables', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New table' })).toBeInTheDocument();
  });

  it('lists the default table first even when the API returns it last', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Standard', level: 2 });

    expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
      'Standard',
      'Flat',
    ]);
  });

  it('summarises limited brackets as "up to <limit> · <rate>%" and the open one as "above · <rate>%"', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Standard', level: 2 });
    const card = within(cardOf('Standard'));

    expect(card.getByText('up to 10,000.00 · 0%')).toBeInTheDocument();
    expect(card.getByText('up to 20,000.00 · 10%')).toBeInTheDocument();
    expect(card.getByText('above · 15%')).toBeInTheDocument();
  });

  it('drops trailing zeros of a rate but keeps real decimals (10.50 shows as 10.5%)', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Flat', level: 2 });

    expect(within(cardOf('Flat')).getByText('above · 10.5%')).toBeInTheDocument();
  });

  it('shows "Used by N employees" and singular "Used by 1 employee"', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Standard', level: 2 });

    expect(within(cardOf('Standard')).getByText('Used by 12 employees')).toBeInTheDocument();
    expect(within(cardOf('Flat')).getByText('Used by 1 employee')).toBeInTheDocument();
  });

  it('shows the Default badge only on the default table', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Standard', level: 2 });

    expect(within(cardOf('Standard')).getByText('Default')).toBeInTheDocument();
    expect(within(cardOf('Flat')).queryByText('Default')).not.toBeInTheDocument();
  });

  it('shows an alert when the list fails to load', async () => {
    listMock.mockRejectedValue(problemError(500, 'Server error', 'Database unavailable'));
    renderPage();

    const text = await screen.findByText('Database unavailable');
    expect(text.closest('[role="alert"]')).not.toBeNull();
  });
});

describe('Tax tables page - row menu (edge case 4)', () => {
  it('offers only Edit on the default table', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Standard', level: 2 });
    await userEvent.click(actionsOf('Standard'));

    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Edit']);
  });

  it('offers Edit, Set as default and Delete on other tables', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Flat', level: 2 });
    await userEvent.click(actionsOf('Flat'));

    expect(screen.getAllByRole('menuitem').map((i) => i.textContent)).toEqual([
      'Edit',
      'Set as default',
      'Delete',
    ]);
  });
});

describe('Tax tables page - delete (edge case 5)', () => {
  const dialog = () => screen.getByRole('dialog', { name: 'Delete Flat?' });
  const confirmButton = () => within(dialog()).getByRole('button', { name: 'Delete' });

  async function openDelete() {
    await screen.findByRole('heading', { name: 'Flat', level: 2 });
    await openMenuItem('Flat', 'Delete');
    await screen.findByRole('dialog');
  }

  it('asks for confirmation before deleting', async () => {
    renderPage();
    await openDelete();

    expect(dialog()).toBeInTheDocument();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('deletes after confirming, closes the dialog and refetches the list', async () => {
    renderPage();
    await openDelete();
    const callsBefore = listMock.mock.calls.length;

    await userEvent.click(confirmButton());

    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(flat.id));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('shows a 409 detail inside the dialog and keeps it open', async () => {
    deleteMock.mockRejectedValue(
      problemError(409, 'Conflict', 'Used by 1 employee'),
    );
    renderPage();
    await openDelete();

    await userEvent.click(confirmButton());

    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Used by 1 employee');
  });
});

describe('Tax tables page - set as default (edge case 6)', () => {
  it('toasts "<name> is now the default" and refetches so the badge and order update', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Flat', level: 2 });
    listMock.mockResolvedValue([
      { ...standard, isDefault: false },
      { ...flat, isDefault: true },
    ]);

    await openMenuItem('Flat', 'Set as default');

    expect(await screen.findByText('Flat is now the default')).toBeInTheDocument();
    expect(setDefaultMock).toHaveBeenCalledWith(flat.id);
    await waitFor(() =>
      expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
        'Flat',
        'Standard',
      ]),
    );
    expect(within(cardOf('Flat')).getByText('Default')).toBeInTheDocument();
    expect(within(cardOf('Standard')).queryByText('Default')).not.toBeInTheDocument();
  });
});

describe('Tax table drawer - bracket rows (edge case 7)', () => {
  it('starts "New tax table" with one open bracket: "No limit" and an empty rate', async () => {
    renderPage();
    const dialog = await openNew();

    expect(nameField(dialog)).toHaveValue('');
    expect(bracket(dialog, 1)).toHaveAccessibleName('Bracket 1: any amount');
    expect(within(bracket(dialog, 1)).getByText('No limit')).toBeInTheDocument();
    expect(rate(dialog, 1)).toHaveValue('');
    expect(hasUpTo(dialog, 1)).toBe(false);
  });

  it('hides the remove button when only one bracket remains', async () => {
    renderPage();
    const dialog = await openNew();

    expect(within(dialog).queryByRole('button', { name: /^Remove bracket/ })).not.toBeInTheDocument();
  });

  it('"Add bracket" inserts a limited row before the open one', async () => {
    renderPage();
    const dialog = await openNew();
    await userEvent.type(rate(dialog, 1), '15');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add bracket' }));

    expect(upTo(dialog, 1)).toHaveValue('');
    expect(rate(dialog, 1)).toHaveValue('');
    expect(hasUpTo(dialog, 2)).toBe(false);
    expect(rate(dialog, 2)).toHaveValue('15');
    expect(within(bracket(dialog, 2)).getByText('No limit')).toBeInTheDocument();
  });

  it('lets a limited row be removed but never the open last row', async () => {
    renderPage();
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add bracket' }));

    expect(within(dialog).getByRole('button', { name: 'Remove bracket 1' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Remove bracket 2' })).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Remove bracket 1' }));

    expect(hasUpTo(dialog, 1)).toBe(false);
    expect(within(dialog).queryByRole('button', { name: /^Remove bracket/ })).not.toBeInTheDocument();
  });

  it('names each bracket by its range, taken from the previous limit', async () => {
    renderPage();
    const dialog = await openEdit('Standard');

    expect(bracket(dialog, 1)).toHaveAccessibleName('Bracket 1: from 0.00');
    expect(bracket(dialog, 2)).toHaveAccessibleName('Bracket 2: from 10,000.00');
    expect(bracket(dialog, 3)).toHaveAccessibleName('Bracket 3: above 20,000.00');
  });

  it('prefills the edit drawer with the table, formatting limits and rates to 2 decimals', async () => {
    renderPage();
    const dialog = await openEdit('Standard');

    expect(nameField(dialog)).toHaveValue('Standard');
    expect(upTo(dialog, 1)).toHaveValue('10,000.00');
    expect(rate(dialog, 1)).toHaveValue('0.00');
    expect(upTo(dialog, 2)).toHaveValue('20,000.00');
    expect(rate(dialog, 2)).toHaveValue('10.00');
    expect(rate(dialog, 3)).toHaveValue('15.00');
  });
});

describe('Tax table drawer - validation (edge case 8)', () => {
  it('validates the name on blur with the shared schema message', async () => {
    renderPage();
    const dialog = await openNew();

    await userEvent.click(nameField(dialog));
    await userEvent.tab();

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();
    expect(nameField(dialog)).toBeInvalid();
  });

  it('shows every error at once on submit and does not call the API', async () => {
    renderPage();
    const dialog = await openNew();

    await userEvent.click(save(dialog));

    expect(await within(dialog).findByText('Name is required')).toBeInTheDocument();
    expect(rate(dialog, 1)).toBeInvalid();
    expect(rate(dialog, 1)).toHaveAccessibleDescription(/rate between 0 and 100/i);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('reports a limit that is not above the previous one on that row', async () => {
    renderPage();
    const dialog = await openNew();
    await userEvent.type(nameField(dialog), 'Tiered');
    await userEvent.type(rate(dialog, 1), '15');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add bracket' }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add bracket' }));
    await userEvent.type(upTo(dialog, 1), '20000');
    await userEvent.type(rate(dialog, 1), '0');
    await userEvent.type(upTo(dialog, 2), '10000');
    await userEvent.type(rate(dialog, 2), '5');

    await userEvent.click(save(dialog));

    expect(upTo(dialog, 2)).toHaveAccessibleDescription('Must be greater than the previous upper limit');
    expect(createMock).not.toHaveBeenCalled();
  });

  it('maps a server 400 on brackets.1.upTo to the second row\'s Up to field', async () => {
    updateMock.mockRejectedValue(
      apiError(400, { errors: { 'brackets.1.upTo': ['Must be greater than the previous upper limit'] } }),
    );
    renderPage();
    const dialog = await openEdit('Standard');
    await userEvent.type(nameField(dialog), '2');

    await userEvent.click(save(dialog));

    await within(dialog).findByText('Must be greater than the previous upper limit');
    expect(upTo(dialog, 2)).toHaveAccessibleDescription('Must be greater than the previous upper limit');
    expect(upTo(dialog, 2)).toBeInvalid();
    expect(upTo(dialog, 1)).toBeValid();
  });
});

describe('Tax table drawer - amount inputs (edge case 9)', () => {
  it('formats a limit with separators and 2 decimals on blur', async () => {
    renderPage();
    const dialog = await openNew();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add bracket' }));
    const limit = upTo(dialog, 1);

    expect(limit).toHaveAttribute('inputmode', 'decimal');
    await userEvent.type(limit, '12000.5');
    await userEvent.tab();

    expect(limit).toHaveValue('12,000.50');
  });

  it('formats a rate to 2 decimals on blur', async () => {
    renderPage();
    const dialog = await openNew();

    await userEvent.type(rate(dialog, 1), '7.5');
    await userEvent.tab();

    expect(rate(dialog, 1)).toHaveValue('7.50');
  });

  it('keeps an invalid rate as typed and shows the schema error', async () => {
    renderPage();
    const dialog = await openNew();

    await userEvent.type(rate(dialog, 1), '101');
    await userEvent.tab();

    expect(rate(dialog, 1)).toHaveValue('101');
    expect(await within(dialog).findByText(/rate between 0 and 100/i)).toBeInTheDocument();
  });
});

describe('Tax table drawer - saving (edge case 10)', () => {
  async function fillValidCreate(dialog: HTMLElement) {
    await userEvent.type(nameField(dialog), 'Tiered');
    await userEvent.type(rate(dialog, 1), '15');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add bracket' }));
    await userEvent.type(upTo(dialog, 1), '10,000');
    await userEvent.type(rate(dialog, 1), '0');
  }

  it('creates with normalised strings: limits and rates with 2 decimals, open bracket upTo null', async () => {
    renderPage();
    const dialog = await openNew();
    await fillValidCreate(dialog);
    const callsBefore = listMock.mock.calls.length;

    await userEvent.click(save(dialog));

    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    expect(createMock.mock.calls[0]?.[0]).toEqual({
      name: 'Tiered',
      brackets: [
        { upTo: '10000.00', rate: '0.00' },
        { upTo: null, rate: '15.00' },
      ],
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('updates an existing table by id', async () => {
    renderPage();
    const dialog = await openEdit('Standard');
    await userEvent.clear(nameField(dialog));
    await userEvent.type(nameField(dialog), 'Standard 2027');

    await userEvent.click(save(dialog));

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[0]).toBe(standard.id);
    expect(updateMock.mock.calls[0]?.[1]).toEqual({
      name: 'Standard 2027',
      brackets: [
        { upTo: '10000.00', rate: '0.00' },
        { upTo: '20000.00', rate: '10.00' },
        { upTo: null, rate: '15.00' },
      ],
    });
  });

  it('shows a 422 rate ceiling as a form alert with the server detail, drawer still open', async () => {
    const detail = 'Highest bracket rate + insurance rate must not exceed 100%';
    createMock.mockRejectedValue(
      apiError(422, { type: ProblemType.businessRuleViolation, detail }),
    );
    renderPage();
    const dialog = await openNew();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(detail);
    expect(dialog).toBeInTheDocument();
    expect(save(dialog)).toBeEnabled();
    expect(nameField(dialog)).toHaveValue('Tiered');
  });

  it('shows a 409 duplicate name on the Name field', async () => {
    createMock.mockRejectedValue(
      apiError(409, { type: ProblemType.conflict, detail: 'A tax table named "Tiered" already exists' }),
    );
    renderPage();
    const dialog = await openNew();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));

    await within(dialog).findByText('A tax table named "Tiered" already exists');
    expect(nameField(dialog)).toHaveAccessibleDescription('A tax table named "Tiered" already exists');
    expect(nameField(dialog)).toBeInvalid();
  });
});

describe('Tax table drawer - unsaved guard (edge case 11)', () => {
  const confirm = () => screen.getByRole('dialog', { name: 'Discard unsaved changes?' });

  const closers: [string, (dialog: HTMLElement) => Promise<void> | void][] = [
    ['the close button', (d) => userEvent.click(within(d).getByRole('button', { name: /close/i }))],
    ['Cancel', (d) => userEvent.click(within(d).getByRole('button', { name: 'Cancel' }))],
    ['Esc', (d) => void fireEvent(d, new Event('cancel', { cancelable: true }))],
  ];

  async function dirtyNew() {
    const dialog = await openNew();
    await userEvent.type(nameField(dialog), 'Tie');
    return dialog;
  }

  it.each(closers)('asks before discarding a dirty form via %s', async (_name, close) => {
    renderPage();
    const dialog = await dirtyNew();

    await close(dialog);

    expect(confirm()).toBeInTheDocument();
    expect(drawer('New tax table')).toBeInTheDocument();
  });

  it('Discard closes the drawer', async () => {
    renderPage();
    const dialog = await dirtyNew();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(within(confirm()).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Keep editing returns to the form with the input intact', async () => {
    renderPage();
    const dialog = await dirtyNew();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(within(confirm()).getByRole('button', { name: 'Keep editing' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument(),
    );
    expect(nameField(dialog)).toHaveValue('Tie');
  });

  it.each(closers)('does not ask on a clean form (%s)', async (_name, close) => {
    renderPage();
    const dialog = await openNew();

    await close(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('asks when an edit form is dirty', async () => {
    renderPage();
    const dialog = await openEdit('Standard');
    await userEvent.type(nameField(dialog), 'x');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(confirm()).toBeInTheDocument();
  });
});
