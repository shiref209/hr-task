import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchDepartments, fetchEmployees } from '../features/employees/api/employees-api';
import { departments, pageOf } from '../features/employees/test-utils';
import { fetchSocialInsurance, fetchTaxTables } from '../features/payroll/api/payroll-api';
import { aSocialInsurance } from '../features/payroll/test-utils';
import { ToastProvider } from '../shared/ui';
import { AppRoutes } from './router';

// Session is mocked as a signed-in HR user (plain functions: survive vi.resetAllMocks).
vi.mock('../features/auth/api/auth-api', async () => {
  const { anAuthUser } = await import('../features/auth/test-utils');
  return {
    fetchMe: async () => anAuthUser('HR'),
    login: async () => anAuthUser('HR'),
    logout: async () => undefined,
    fetchMyTaxTable: async () => undefined,
  };
});

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

function LocationProbe() {
  const { pathname } = useLocation();
  return <output data-testid="pathname">{pathname}</output>;
}

function renderAt(path: string) {
  window.history.replaceState(null, '', '/');
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const pathname = () => screen.getByTestId('pathname').textContent;
const mainNav = () => screen.getByRole('navigation', { name: 'Main' });
const link = (name: string) => within(mainNav()).getByRole('link', { name });
const menuButton = () => screen.getByRole('button', { name: 'Open menu' });

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchEmployees).mockResolvedValue(pageOf([]));
  vi.mocked(fetchDepartments).mockResolvedValue(departments);
  vi.mocked(fetchTaxTables).mockResolvedValue([]);
  vi.mocked(fetchSocialInsurance).mockResolvedValue(aSocialInsurance());
});

describe('App routes - redirects and 404 (edge case 1)', () => {
  it('redirects / to /employees', async () => {
    renderAt('/');

    expect(await screen.findByRole('heading', { name: 'Employees', level: 1 })).toBeInTheDocument();
    expect(pathname()).toBe('/employees');
  });

  it.each([
    ['/employees', 'Employees'],
    ['/settings/tax-tables', 'Tax tables'],
    ['/settings/social-insurance', 'Social insurance'],
  ])('renders the %s page', async (path, heading) => {
    renderAt(path);

    expect(await screen.findByRole('heading', { name: heading, level: 1 })).toBeInTheDocument();
    expect(pathname()).toBe(path);
  });

  it('shows "Page not found" with a link back for an unknown path', async () => {
    renderAt('/nope/at/all');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    const back = within(screen.getByRole('main')).getByRole('link', { name: /employees/i });
    expect(back).toHaveAttribute('href', '/employees');
  });

  it('keeps the sidebar visible on the not-found page', async () => {
    renderAt('/nope');

    await screen.findByRole('heading', { name: 'Page not found' });
    expect(mainNav()).toBeInTheDocument();
  });
});

describe('App routes - sidebar (edge case 2)', () => {
  it('lists Employees, Tax tables and Social insurance links under a Settings heading', async () => {
    renderAt('/employees');

    await screen.findByRole('heading', { name: 'Employees', level: 1 });
    expect(within(mainNav()).getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Employees',
      'Tax tables',
      'Social insurance',
    ]);
    expect(within(mainNav()).getByText('Settings')).toBeInTheDocument();
    expect(link('Tax tables')).toHaveAttribute('href', '/settings/tax-tables');
    expect(link('Social insurance')).toHaveAttribute('href', '/settings/social-insurance');
  });

  it('marks only the current link with aria-current="page"', async () => {
    renderAt('/settings/tax-tables');

    await screen.findByRole('heading', { name: 'Tax tables', level: 1 });
    expect(link('Tax tables')).toHaveAttribute('aria-current', 'page');
    expect(link('Employees')).not.toHaveAttribute('aria-current');
    expect(link('Social insurance')).not.toHaveAttribute('aria-current');
  });

  it('moves aria-current when navigating with a link', async () => {
    renderAt('/employees');
    await screen.findByRole('heading', { name: 'Employees', level: 1 });

    await userEvent.click(link('Social insurance'));

    expect(await screen.findByRole('heading', { name: 'Social insurance', level: 1 })).toBeInTheDocument();
    expect(pathname()).toBe('/settings/social-insurance');
    expect(link('Social insurance')).toHaveAttribute('aria-current', 'page');
    expect(link('Employees')).not.toHaveAttribute('aria-current');
  });
});

describe('App routes - mobile menu (edge case 2)', () => {
  it('starts collapsed and the button reports its state via aria-expanded', async () => {
    renderAt('/employees');
    await screen.findByRole('heading', { name: 'Employees', level: 1 });

    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles the sidebar sheet open and closed from the button', async () => {
    renderAt('/employees');
    await screen.findByRole('heading', { name: 'Employees', level: 1 });

    await userEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Esc and returns focus to the button', async () => {
    renderAt('/employees');
    await screen.findByRole('heading', { name: 'Employees', level: 1 });
    await userEvent.click(menuButton());

    await userEvent.keyboard('{Escape}');

    await waitFor(() => expect(menuButton()).toHaveAttribute('aria-expanded', 'false'));
    expect(menuButton()).toHaveFocus();
  });

  it('closes when a link is chosen, navigates, and returns focus to the button', async () => {
    renderAt('/employees');
    await screen.findByRole('heading', { name: 'Employees', level: 1 });
    await userEvent.click(menuButton());

    await userEvent.click(link('Tax tables'));

    expect(await screen.findByRole('heading', { name: 'Tax tables', level: 1 })).toBeInTheDocument();
    expect(menuButton()).toHaveAttribute('aria-expanded', 'false');
    expect(menuButton()).toHaveFocus();
  });
});
