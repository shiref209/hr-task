import { ProblemType } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMe, logout } from '../features/auth/api/auth-api';
import { anAuthUser } from '../features/auth/test-utils';
import { fetchDepartments, fetchEmployees } from '../features/employees/api/employees-api';
import { anEmployee, departments, pageOf } from '../features/employees/test-utils';
import { fetchSocialInsurance, fetchTaxTables } from '../features/payroll/api/payroll-api';
import { aSocialInsurance } from '../features/payroll/test-utils';
import { ApiError } from '../shared/http/http-client';
import { ToastProvider } from '../shared/ui';
import { AppRoutes } from './router';

vi.mock('../features/auth/api/auth-api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  fetchMyTaxTable: vi.fn(),
}));
vi.mock('../features/employees/api/employees-api', () => ({
  fetchEmployees: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchEmployee: vi.fn(),
  createEmployee: vi.fn(),
  updateEmployee: vi.fn(),
  restoreEmployee: vi.fn(),
  deleteEmployee: vi.fn(),
  uploadProfileImage: vi.fn(),
}));
vi.mock('../features/payroll/api/payroll-api', () => ({
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

const meMock = vi.mocked(fetchMe);
const logoutMock = vi.mocked(logout);

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

let client: QueryClient;
function renderAt(path: string) {
  window.history.replaceState(null, '', '/');
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const mainNav = () => screen.getByRole('navigation', { name: 'Main' });
const navLinks = () => within(mainNav()).getAllByRole('link').map((a) => a.textContent);

beforeEach(() => {
  vi.resetAllMocks();
  meMock.mockResolvedValue(anAuthUser('HR'));
  logoutMock.mockResolvedValue(undefined);
  vi.mocked(fetchEmployees).mockResolvedValue(pageOf([anEmployee(1)]));
  vi.mocked(fetchDepartments).mockResolvedValue(departments);
  vi.mocked(fetchTaxTables).mockResolvedValue([]);
  vi.mocked(fetchSocialInsurance).mockResolvedValue(aSocialInsurance());
});

describe('Auth routes - signed out (edge case 16)', () => {
  it.each([
    ['null', () => meMock.mockResolvedValue(null)],
    [
      'a 401',
      () =>
        meMock.mockRejectedValue(
          new ApiError({ type: ProblemType.unauthorized, title: 'Unauthorized', status: 401 }),
        ),
    ],
  ])('redirects /employees to /login?next=%%2Femployees when /auth/me gives %s', async (_label, arrange) => {
    arrange();
    renderAt('/employees');

    await screen.findByLabelText('Email');
    expect(where()).toBe('/login?next=%2Femployees');
  });

  it('keeps the query string in next', async () => {
    meMock.mockResolvedValue(null);
    renderAt('/settings/tax-tables?x=1');

    await screen.findByLabelText('Email');
    expect(where()).toBe(`/login?next=${encodeURIComponent('/settings/tax-tables?x=1')}`);
  });

  it('does not fetch any data while signed out', async () => {
    meMock.mockResolvedValue(null);
    renderAt('/employees');

    await screen.findByLabelText('Email');
    expect(fetchEmployees).not.toHaveBeenCalled();
  });

  it('shows the sign-in page itself without redirecting', async () => {
    meMock.mockResolvedValue(null);
    renderAt('/login');

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(where()).toBe('/login');
  });
});

describe('Auth routes - HR', () => {
  it('shows Employees plus the Settings links, and no "My pay"', async () => {
    renderAt('/employees');

    await screen.findByRole('heading', { name: 'Employees', level: 1 });
    expect(navLinks()).toEqual(['Employees', 'Tax tables', 'Social insurance']);
    expect(within(mainNav()).getByText('Settings')).toBeInTheDocument();
  });

  it('shows the user name and role in the sidebar', async () => {
    renderAt('/employees');

    const name = await screen.findByText('Hana Hassan');
    expect(name.parentElement).toHaveTextContent(/\bHR\b/);
  });

  it('can open a settings page', async () => {
    renderAt('/settings/tax-tables');

    expect(await screen.findByRole('heading', { name: 'Tax tables', level: 1 })).toBeInTheDocument();
  });
});

describe('Auth routes - EMPLOYEE (edge case 23)', () => {
  beforeEach(() => meMock.mockResolvedValue(anAuthUser('EMPLOYEE')));

  it('shows Employees and "My pay" and no Settings', async () => {
    renderAt('/employees');

    await screen.findByRole('heading', { name: 'Employees', level: 1 });
    expect(navLinks()).toEqual(['Employees', 'My pay']);
    expect(within(mainNav()).queryByText('Settings')).not.toBeInTheDocument();
    expect(within(mainNav()).getByRole('link', { name: 'My pay' })).toHaveAttribute('href', '/my-pay');
  });

  it('shows the user name and role in the sidebar', async () => {
    renderAt('/employees');

    const name = await screen.findByText('Omar Farouk');
    expect(name.parentElement).toHaveTextContent(/employee/i);
  });

  it.each(['/settings/tax-tables', '/settings/social-insurance'])(
    'shows "You don\'t have access" at %s and loads no settings data',
    async (path) => {
      renderAt(path);

      expect(await screen.findByText("You don't have access")).toBeInTheDocument();
      expect(fetchTaxTables).not.toHaveBeenCalled();
      expect(fetchSocialInsurance).not.toHaveBeenCalled();
    },
  );
});

describe('Auth routes - sign out (edge case 18)', () => {
  it('calls logout, clears the whole query cache and lands on /login', async () => {
    renderAt('/employees');
    await screen.findByRole('heading', { name: 'Employees', level: 1 });
    client.setQueryData(['previous-user-data'], { secret: true });
    meMock.mockResolvedValue(null); // the cookies are gone after logout

    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() => expect(where()).toMatch(/^\/login/));
    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryData(['previous-user-data'])).toBeUndefined();
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByText('Employee 1')).not.toBeInTheDocument();
  });
});
