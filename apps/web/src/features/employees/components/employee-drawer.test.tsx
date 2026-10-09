import { ProblemType, type Employee } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
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
import { anEmployee, DEPARTMENT_IDS, departments, pageOf } from '../test-utils';

vi.mock('../api/employees-api', () => ({
  fetchEmployees: vi.fn(),
  fetchDepartments: vi.fn(),
  restoreEmployee: vi.fn(),
  fetchEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  uploadProfileImage: vi.fn(),
}));

const listMock = vi.mocked(fetchEmployees);
const detailMock = vi.mocked(fetchEmployee);
const createMock = vi.mocked(createEmployee);
const updateMock = vi.mocked(updateEmployee);
const uploadMock = vi.mocked(uploadProfileImage);

const MB = 1024 * 1024;
const existing = anEmployee(1, { fullName: 'Ahmed Zaki', baseSalary: '12500.00' });

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
  new ApiError({ type: ProblemType.validationError, title: 'Problem', status, ...extra });

const newEmployeeButton = () => screen.getByRole('button', { name: /new employee/i });
const field = (dialog: HTMLElement, label: string) =>
  within(dialog).getByLabelText(new RegExp(`^${label}`));
const createDrawer = () => screen.getByRole('dialog', { name: 'New employee' });

async function openCreate() {
  await screen.findByRole('table');
  await userEvent.click(newEmployeeButton());
  return createDrawer();
}

async function openEdit(name = 'Ahmed Zaki') {
  await screen.findByRole('table');
  await userEvent.click(screen.getByRole('button', { name: `Actions for ${name}` }));
  await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));
  return screen.findByRole('dialog', { name: `Edit ${name}` });
}

async function fillValidCreate(dialog: HTMLElement) {
  await userEvent.type(field(dialog, 'Full name'), 'Mona Hassan');
  await userEvent.type(field(dialog, 'Email'), 'mona@example.com');
  await userEvent.type(field(dialog, 'Base salary'), '12,500.5');
  await userEvent.type(field(dialog, 'Job title'), 'HR Manager');
  await userEvent.selectOptions(field(dialog, 'Department'), 'Operations');
  fireEvent.change(field(dialog, 'Hire date'), { target: { value: '2024-01-15' } });
}

const save = (dialog: HTMLElement) => within(dialog).getByRole('button', { name: 'Save' });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchDepartments).mockResolvedValue(departments);
  vi.mocked(restoreEmployee).mockResolvedValue(existing);
  listMock.mockResolvedValue(pageOf([existing]));
  detailMock.mockResolvedValue(existing);
  createMock.mockResolvedValue(anEmployee(2));
  updateMock.mockResolvedValue(existing);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Employee drawer - opening (edge cases 1, 2, 14)', () => {
  it('opens the create drawer from the header button with focus on Full name', async () => {
    renderPage();
    const dialog = await openCreate();

    await waitFor(() => expect(field(dialog, 'Full name')).toHaveFocus());
  });

  it('opens the create drawer from the "No employees yet" empty state too', async () => {
    listMock.mockResolvedValue(pageOf([]));
    renderPage();
    const empty = await screen.findByText('No employees yet');

    await userEvent.click(within(empty.parentElement ?? document.body).getByRole('button', { name: /new employee/i }));

    expect(createDrawer()).toBeInTheDocument();
  });

  it('adds Edit to the menu of active rows', async () => {
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Ahmed Zaki' }));
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toBeInTheDocument();
  });

  it('lists the fields in order: Full name, Email, Base salary, Job title, Department, Hire date, Phone, Status, Type', async () => {
    renderPage();
    const dialog = await openCreate();

    const labels = Array.from(
      dialog.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input:not([type="file"]), select'),
    ).map((control) => (control.labels?.[0]?.textContent ?? '').replace(/\s*\*$/, '').trim());
    expect(labels).toEqual([
      'Full name',
      'Email',
      'Base salary',
      'Job title',
      'Department',
      'Hire date',
      'Phone',
      'Status',
      'Type',
    ]);
  });

  it('marks the six required fields as required and Phone as optional', async () => {
    renderPage();
    const dialog = await openCreate();

    for (const label of ['Full name', 'Email', 'Base salary', 'Job title', 'Department', 'Hire date']) {
      expect(field(dialog, label)).toHaveAttribute('aria-required', 'true');
    }
    expect(field(dialog, 'Phone')).not.toHaveAttribute('aria-required', 'true');
    expect(dialog.querySelector('[required]')).toBeNull();
  });

  it('defaults Status to Active and Type to Employee', async () => {
    renderPage();
    const dialog = await openCreate();

    expect(field(dialog, 'Status')).toHaveDisplayValue('Active');
    expect(field(dialog, 'Type')).toHaveDisplayValue('Employee');
  });

  it('offers the loaded departments', async () => {
    renderPage();
    const dialog = await openCreate();

    expect(within(field(dialog, 'Department')).getByRole('option', { name: 'Finance' })).toBeInTheDocument();
  });

  it('names the dialogs "New employee" and "Edit <name>"', async () => {
    renderPage();
    await openCreate();
    await userEvent.click(within(createDrawer()).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    expect(await openEdit()).toBeInTheDocument();
  });

  it('returns focus to the header button when the create drawer closes', async () => {
    renderPage();
    const dialog = await openCreate();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(newEmployeeButton()).toHaveFocus());
  });

  it('returns focus to the row menu button when the edit drawer closes', async () => {
    renderPage();
    const dialog = await openEdit();
    await screen.findByDisplayValue('Ahmed Zaki');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Actions for Ahmed Zaki' })).toHaveFocus(),
    );
  });
});

describe('Employee drawer - validation (edge cases 3, 4, 5, 6)', () => {
  it('validates a field on blur with the shared schema message', async () => {
    renderPage();
    const dialog = await openCreate();

    await userEvent.click(field(dialog, 'Full name'));
    await userEvent.tab();

    expect(await within(dialog).findByText(/full name is required/i)).toBeInTheDocument();
    expect(field(dialog, 'Full name')).toBeInvalid();
  });

  it('shows every error at once on submit and focuses the first invalid field', async () => {
    renderPage();
    const dialog = await openCreate();

    await userEvent.click(save(dialog));

    await waitFor(() => expect(field(dialog, 'Full name')).toHaveFocus());
    for (const label of ['Full name', 'Email', 'Base salary', 'Job title', 'Department', 'Hire date']) {
      expect(field(dialog, label)).toBeInvalid();
    }
    expect(createMock).not.toHaveBeenCalled();
  });

  it('focuses the first invalid field, not the first field', async () => {
    renderPage();
    const dialog = await openCreate();
    await userEvent.type(field(dialog, 'Full name'), 'Mona Hassan');

    await userEvent.click(save(dialog));

    await waitFor(() => expect(field(dialog, 'Email')).toHaveFocus());
  });

  it('hire date input max = today (local)', async () => {
    vi.setSystemTime(new Date(2026, 9, 8, 23, 30, 0));
    renderPage();
    const dialog = await openCreate();

    expect(field(dialog, 'Hire date')).toHaveAttribute('type', 'date');
    expect(field(dialog, 'Hire date')).toHaveAttribute('max', '2026-10-08');
  });

  it('formats the salary on blur and keeps the number out of the input as a JS number', async () => {
    renderPage();
    const dialog = await openCreate();
    const salary = field(dialog, 'Base salary');

    expect(salary).toHaveAttribute('inputmode', 'decimal');
    await userEvent.type(salary, '12,500.5');
    await userEvent.tab();

    expect(salary).toHaveValue('12,500.50');
  });

  it.each([
    ['12.345', /greater than 0/i],
    ['abc', /greater than 0/i],
    ['0', /greater than 0/i],
  ])('keeps invalid salary %j as typed and shows the schema error', async (typed, message) => {
    renderPage();
    const dialog = await openCreate();
    const salary = field(dialog, 'Base salary');

    await userEvent.type(salary, typed);
    await userEvent.tab();

    expect(salary).toHaveValue(typed);
    expect(await within(dialog).findByText(message)).toBeInTheDocument();
  });

  it('rejects a phone that is not international', async () => {
    renderPage();
    const dialog = await openCreate();

    await userEvent.type(field(dialog, 'Phone'), '123');
    await userEvent.tab();

    expect(
      await within(dialog).findByText(/international format/i),
    ).toBeInTheDocument();
  });
});

describe('Employee drawer - create (edge cases 5, 6, 9, 10, 11)', () => {
  it('sends the normalized salary and an empty phone as null', async () => {
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));

    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    expect(createMock.mock.calls[0]?.[0]).toEqual({
      fullName: 'Mona Hassan',
      email: 'mona@example.com',
      baseSalary: '12500.50',
      jobTitle: 'HR Manager',
      departmentId: DEPARTMENT_IDS.operations,
      hireDate: '2024-01-15',
      phone: null,
      status: 'ACTIVE',
      type: 'EMPLOYEE',
    });
  });

  it('a future hire date shows the future-date error and createEmployee is not called', async () => {
    vi.setSystemTime(new Date(2026, 9, 8, 12, 0, 0));
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);
    fireEvent.change(field(dialog, 'Hire date'), { target: { value: '2026-10-09' } });

    await userEvent.click(save(dialog));

    expect(await within(dialog).findByText(/future/i)).toBeInTheDocument();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('sends a typed phone as is', async () => {
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);
    await userEvent.type(field(dialog, 'Phone'), '+201001234567');

    await userEvent.click(save(dialog));

    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    expect(createMock.mock.calls[0]?.[0]).toMatchObject({ phone: '+201001234567' });
  });

  it('toasts, closes without asking and refetches the list on success', async () => {
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);
    const listCalls = listMock.mock.calls.length;

    await userEvent.click(save(dialog));

    expect(await screen.findByText('Employee created')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
  });

  it('shows loading, disables Save and ignores a second submit while saving, keeping the values', async () => {
    createMock.mockReturnValue(new Promise<Employee>(() => undefined));
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));
    await waitFor(() => expect(save(dialog)).toBeDisabled());
    expect(save(dialog)).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(save(dialog));
    await userEvent.type(field(dialog, 'Phone'), '{Enter}');

    expect(createMock).toHaveBeenCalledOnce();
    expect(field(dialog, 'Full name')).toHaveValue('Mona Hassan');
  });

  it('shows a 400 field error under the matching field', async () => {
    createMock.mockRejectedValue(
      apiError(400, { errors: { jobTitle: ['Job title is not allowed'] } }),
    );
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));

    expect(await within(dialog).findByText('Job title is not allowed')).toBeInTheDocument();
    expect(field(dialog, 'Job title')).toHaveAccessibleDescription('Job title is not allowed');
  });

  it('shows a 409 under the Email field with the server detail', async () => {
    createMock.mockRejectedValue(
      apiError(409, { type: ProblemType.conflict, detail: 'Email already in use' }),
    );
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));

    await within(dialog).findByText('Email already in use');
    expect(field(dialog, 'Email')).toHaveAccessibleDescription('Email already in use');
    expect(field(dialog, 'Email')).toBeInvalid();
  });

  it('toasts a 500, keeps the drawer open with the input intact and re-enables Save', async () => {
    createMock.mockRejectedValue(apiError(500, { title: 'Internal error' }));
    renderPage();
    const dialog = await openCreate();
    await fillValidCreate(dialog);

    await userEvent.click(save(dialog));

    await waitFor(() => expect(createMock).toHaveBeenCalledOnce());
    await waitFor(() => expect(document.querySelector('.toast--error')).not.toBeNull());
    expect(createDrawer()).toBeInTheDocument();
    expect(field(dialog, 'Full name')).toHaveValue('Mona Hassan');
    expect(field(dialog, 'Base salary')).toHaveValue('12,500.50');
    expect(save(dialog)).toBeEnabled();
  });
});

describe('Employee drawer - edit (edge cases 7, 8, 10, 11)', () => {
  it('shows a busy skeleton instead of fields while the employee loads', async () => {
    detailMock.mockReturnValue(new Promise<Employee>(() => undefined));
    renderPage();
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Ahmed Zaki' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(within(dialog).queryByLabelText(/^Full name/)).not.toBeInTheDocument();
    expect(detailMock.mock.calls[0]?.[0]).toBe(existing.id);
  });

  it('pre-fills the form from the loaded employee', async () => {
    detailMock.mockResolvedValue(
      anEmployee(1, {
        fullName: 'Ahmed Zaki',
        baseSalary: '12500.00',
        phone: '+201001234567',
        hireDate: '2024-01-15',
        status: 'INACTIVE',
        type: 'HR',
      }),
    );
    renderPage();
    const dialog = await openEdit();

    expect(await within(dialog).findByDisplayValue('Ahmed Zaki')).toBe(field(dialog, 'Full name'));
    expect(field(dialog, 'Email')).toHaveValue('employee1@example.com');
    expect((field(dialog, 'Base salary') as HTMLInputElement).value).toMatch(/^12,?500\.00$/);
    expect(field(dialog, 'Job title')).toHaveValue('Ops Lead');
    expect(field(dialog, 'Department')).toHaveDisplayValue('Operations');
    expect(field(dialog, 'Hire date')).toHaveValue('2024-01-15');
    expect(field(dialog, 'Phone')).toHaveValue('+201001234567');
    expect(field(dialog, 'Status')).toHaveDisplayValue('Inactive');
    expect(field(dialog, 'Type')).toHaveDisplayValue('HR');
  });

  it('on a 404 toasts, closes the drawer and refetches the list', async () => {
    detailMock.mockRejectedValue(apiError(404, { type: ProblemType.notFound, title: 'Not found' }));
    renderPage();
    await screen.findByRole('table');
    const listCalls = listMock.mock.calls.length;
    await userEvent.click(screen.getByRole('button', { name: 'Actions for Ahmed Zaki' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Edit' }));

    expect(await screen.findByText('This employee no longer exists')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
  });

  it('disables Save while nothing changed', async () => {
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    expect(save(dialog)).toBeDisabled();
  });

  it('enables Save on a change and disables it again when the change is reverted', async () => {
    renderPage();
    const dialog = await openEdit();
    const jobTitle = await within(dialog).findByDisplayValue('Ops Lead');

    await userEvent.type(jobTitle, 'x');
    expect(save(dialog)).toBeEnabled();
    await userEvent.type(jobTitle, '{Backspace}');
    expect(save(dialog)).toBeDisabled();
  });

  it('PATCHes only the changed fields', async () => {
    renderPage();
    const dialog = await openEdit();
    const jobTitle = await within(dialog).findByDisplayValue('Ops Lead');
    await userEvent.clear(jobTitle);
    await userEvent.type(jobTitle, 'Ops Manager');
    await userEvent.selectOptions(field(dialog, 'Status'), 'Inactive');

    await userEvent.click(save(dialog));

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[0]).toBe(existing.id);
    expect(updateMock.mock.calls[0]?.[1]).toEqual({ jobTitle: 'Ops Manager', status: 'INACTIVE' });
  });

  it('sends phone null when the phone is cleared', async () => {
    detailMock.mockResolvedValue({ ...existing, phone: '+201001234567' });
    renderPage();
    const dialog = await openEdit();
    await userEvent.clear(await within(dialog).findByDisplayValue('+201001234567'));

    await userEvent.click(save(dialog));

    await waitFor(() => expect(updateMock).toHaveBeenCalledOnce());
    expect(updateMock.mock.calls[0]?.[1]).toEqual({ phone: null });
  });

  it('toasts "Changes saved", closes without asking and refetches the list', async () => {
    renderPage();
    const dialog = await openEdit();
    await userEvent.type(await within(dialog).findByDisplayValue('Ops Lead'), 'x');
    const listCalls = listMock.mock.calls.length;

    await userEvent.click(save(dialog));

    expect(await screen.findByText('Changes saved')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument();
    await waitFor(() => expect(listMock.mock.calls.length).toBeGreaterThan(listCalls));
  });

  it('shows a 422 (last HR) as a form-level alert with the server detail, drawer still open', async () => {
    detailMock.mockResolvedValue({ ...existing, type: 'HR' });
    updateMock.mockRejectedValue(
      apiError(422, {
        type: ProblemType.businessRuleViolation,
        detail: 'Cannot demote the last HR employee',
      }),
    );
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');
    await userEvent.selectOptions(field(dialog, 'Type'), 'Employee');

    await userEvent.click(save(dialog));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Cannot demote the last HR employee');
    expect(dialog).toBeInTheDocument();
    expect(save(dialog)).toBeEnabled();
  });

  it('shows a 409 on edit under the Email field', async () => {
    updateMock.mockRejectedValue(apiError(409, { type: ProblemType.conflict, detail: 'Email already in use' }));
    renderPage();
    const dialog = await openEdit();
    const email = await within(dialog).findByDisplayValue('employee1@example.com');
    await userEvent.clear(email);
    await userEvent.type(email, 'taken@example.com');

    await userEvent.click(save(dialog));

    await within(dialog).findByText('Email already in use');
    expect(email).toHaveAccessibleDescription('Email already in use');
  });
});

describe('Employee drawer - unsaved guard (edge case 12)', () => {
  const confirm = () => screen.getByRole('dialog', { name: 'Discard unsaved changes?' });

  async function dirtyCreate() {
    const dialog = await openCreate();
    await userEvent.type(field(dialog, 'Full name'), 'Mona');
    return dialog;
  }

  const closers: [string, (dialog: HTMLElement) => Promise<void> | void][] = [
    ['the close button', (d) => userEvent.click(within(d).getByRole('button', { name: /close/i }))],
    ['Cancel', (d) => userEvent.click(within(d).getByRole('button', { name: 'Cancel' }))],
    ['Esc', (d) => void fireEvent(d, new Event('cancel', { cancelable: true }))],
  ];

  it.each(closers)('asks before discarding when closing a dirty form with %s', async (_name, close) => {
    renderPage();
    const dialog = await dirtyCreate();

    await close(dialog);

    expect(confirm()).toBeInTheDocument();
    expect(createDrawer()).toBeInTheDocument();
  });

  it.each(closers)('Discard closes the drawer after %s', async (_name, close) => {
    renderPage();
    const dialog = await dirtyCreate();
    await close(dialog);

    await userEvent.click(within(confirm()).getByRole('button', { name: 'Discard' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('Keep editing returns to the form with the input intact', async () => {
    renderPage();
    const dialog = await dirtyCreate();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await userEvent.click(within(confirm()).getByRole('button', { name: 'Keep editing' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Discard unsaved changes?' })).not.toBeInTheDocument(),
    );
    expect(createDrawer()).toBeInTheDocument();
    expect(field(dialog, 'Full name')).toHaveValue('Mona');
  });

  it.each(closers)('does not ask on a clean form (%s)', async (_name, close) => {
    renderPage();
    const dialog = await openCreate();

    await close(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('asks when an edit form is dirty', async () => {
    renderPage();
    const dialog = await openEdit();
    await userEvent.type(await within(dialog).findByDisplayValue('Ops Lead'), 'x');

    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(confirm()).toBeInTheDocument();
  });
});

describe('Employee drawer - photo (edge case 13)', () => {
  const fileInput = (dialog: HTMLElement) => {
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input in the drawer');
    return input;
  };
  const fileOfSize = (size: number, type = 'image/png', name = 'photo.png') => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
  };

  it('shows a hint instead of the photo control when creating', async () => {
    renderPage();
    const dialog = await openCreate();

    expect(within(dialog).getByText(/add a photo after saving/i)).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Change photo' })).not.toBeInTheDocument();
    expect(dialog.querySelector('input[type="file"]')).toBeNull();
  });

  it('shows the avatar and a Change photo control accepting jpeg, png and webp when editing', async () => {
    detailMock.mockResolvedValue({ ...existing, profileImageUrl: 'http://img.test/a.png' });
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    expect(within(dialog).getByRole('button', { name: 'Change photo' })).toBeInTheDocument();
    expect(within(dialog).getByRole('img', { name: 'Ahmed Zaki' })).toHaveAttribute('src', 'http://img.test/a.png');
    const accept = fileInput(dialog).accept;
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) expect(accept).toContain(type);
    expect(within(dialog).queryByText(/add a photo after saving/i)).not.toBeInTheDocument();
  });

  it('uploads immediately, independent of Save, and updates the avatar', async () => {
    uploadMock.mockResolvedValue({ ...existing, profileImageUrl: 'http://img.test/new.png' });
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');
    const file = fileOfSize(1 * MB);

    await userEvent.upload(fileInput(dialog), file);

    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());
    expect(uploadMock.mock.calls[0]?.[0]).toBe(existing.id);
    expect(uploadMock.mock.calls[0]?.[1]).toBe(file);
    expect(await within(dialog).findByRole('img', { name: 'Ahmed Zaki' })).toHaveAttribute(
      'src',
      'http://img.test/new.png',
    );
    expect(updateMock).not.toHaveBeenCalled();
    expect(save(dialog)).toBeDisabled();
  });

  it('accepts a file of exactly 2 MB', async () => {
    uploadMock.mockResolvedValue(existing);
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    await userEvent.upload(fileInput(dialog), fileOfSize(2 * MB));

    await waitFor(() => expect(uploadMock).toHaveBeenCalledOnce());
  });

  it('disables Change photo and marks it busy while uploading', async () => {
    uploadMock.mockReturnValue(new Promise<Employee>(() => undefined));
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    await userEvent.upload(fileInput(dialog), fileOfSize(1 * MB));

    const change = within(dialog).getByRole('button', { name: 'Change photo' });
    await waitFor(() => expect(change).toBeDisabled());
    expect(change).toHaveAttribute('aria-busy', 'true');
  });

  it('rejects a file over 2 MB inline without calling the API', async () => {
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    await userEvent.upload(fileInput(dialog), fileOfSize(2 * MB + 1));

    expect(await within(dialog).findByText(/2 MB/)).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('rejects a non-image type inline without calling the API', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    await user.upload(fileInput(dialog), fileOfSize(1000, 'application/pdf', 'cv.pdf'));

    expect(await within(dialog).findByText(/JPEG, PNG or WebP/i)).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it.each([
    [413, ProblemType.payloadTooLarge, 'File too large for the server'],
    [415, ProblemType.unsupportedMediaType, 'Unsupported image type'],
  ])('shows a server %i inline with its detail', async (status, type, detail) => {
    uploadMock.mockRejectedValue(apiError(status, { type, detail }));
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    await userEvent.upload(fileInput(dialog), fileOfSize(1 * MB));

    expect(await within(dialog).findByText(detail)).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });
});

describe('Employee drawer - browser-check defects', () => {
  const assetUrl = `${http.defaults.baseURL ?? ''}/uploads/employees/x.png`;

  it('serves a relative profile image from the API origin in the list row', async () => {
    listMock.mockResolvedValue(pageOf([{ ...existing, profileImageUrl: '/uploads/employees/x.png' }]));
    renderPage();
    const table = await screen.findByRole('table');

    expect(within(table).getByRole('img', { name: 'Ahmed Zaki' })).toHaveAttribute('src', assetUrl);
  });

  it('serves a relative profile image from the API origin in the edit drawer', async () => {
    detailMock.mockResolvedValue({ ...existing, profileImageUrl: '/uploads/employees/x.png' });
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');

    expect(within(dialog).getByRole('img', { name: 'Ahmed Zaki' })).toHaveAttribute('src', assetUrl);
  });

  it('serves the uploaded relative image from the API origin', async () => {
    uploadMock.mockResolvedValue({ ...existing, profileImageUrl: '/uploads/employees/x.png' });
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');
    const input = dialog.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input in the drawer');

    await userEvent.upload(input, new File(['x'], 'photo.png', { type: 'image/png' }));

    expect(await within(dialog).findByRole('img', { name: 'Ahmed Zaki' })).toHaveAttribute('src', assetUrl);
  });

  it('focuses the form-level 422 alert so it is announced and scrolled into view', async () => {
    detailMock.mockResolvedValue({ ...existing, type: 'HR' });
    updateMock.mockRejectedValue(
      apiError(422, { type: ProblemType.businessRuleViolation, detail: 'Cannot demote the last HR employee' }),
    );
    renderPage();
    const dialog = await openEdit();
    await within(dialog).findByDisplayValue('Ahmed Zaki');
    await userEvent.selectOptions(field(dialog, 'Type'), 'Employee');

    await userEvent.click(save(dialog));

    const alert = await within(dialog).findByRole('alert');
    await waitFor(() => expect(document.activeElement).toBe(alert));
  });

  it('turns off native constraint validation on the form', async () => {
    renderPage();
    const dialog = await openCreate();

    const form = dialog.querySelector('form');
    expect(form).not.toBeNull();
    expect(form?.noValidate).toBe(true);
  });
});
