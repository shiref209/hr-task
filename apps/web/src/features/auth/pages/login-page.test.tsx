import { ProblemType } from '@hr/types';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../shared/http/http-client';
import { ToastProvider } from '../../../shared/ui';
import { fetchMe, login } from '../api/auth-api';
import { anAuthUser } from '../test-utils';
import { LoginPage } from './login-page';

// Assumed: LoginPage is a named export; auth-api exports login(input) -> AuthUser,
// fetchMe() -> AuthUser | null (null when signed out).
vi.mock('../api/auth-api', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  fetchMe: vi.fn(),
  fetchMyTaxTable: vi.fn(),
}));

const loginMock = vi.mocked(login);
const meMock = vi.mocked(fetchMe);

function Where() {
  const { pathname, search } = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}

function renderLogin(url = '/login') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <MemoryRouter initialEntries={[url]}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<p>elsewhere</p>} />
          </Routes>
          <Where />
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

const where = () => screen.getByTestId('where').textContent;
const email = () => screen.findByLabelText('Email');
const password = () => screen.getByLabelText('Password');
const submit = () => screen.getByRole('button', { name: 'Sign in' });

async function signIn(emailText = 'test@hr.com', passwordText = 'test@123') {
  await userEvent.type(await email(), emailText);
  await userEvent.type(password(), passwordText);
  await userEvent.click(submit());
}

const problem = (status: number, title: string, detail?: string) =>
  new ApiError({
    type: status === 429 ? ProblemType.tooManyRequests : ProblemType.unauthorized,
    title,
    status,
    detail,
  });

beforeEach(() => {
  vi.resetAllMocks();
  meMock.mockResolvedValue(null);
});

describe('LoginPage - form', () => {
  it('shows Email and Password fields and a "Sign in" button', async () => {
    renderLogin();

    expect(await email()).toBeInTheDocument();
    expect(password()).toBeInTheDocument();
    expect(submit()).toBeEnabled();
  });

  it('masks the password', async () => {
    renderLogin();
    await email();

    expect(password()).toHaveAttribute('type', 'password');
  });

  it('shows the schema messages and does not call the API for an empty form', async () => {
    renderLogin();
    await email();

    await userEvent.click(submit());

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed email with the schema message', async () => {
    renderLogin();

    await signIn('not-an-email', 'whatever');

    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it('submits the trimmed, lowercased email and the password as typed', async () => {
    loginMock.mockResolvedValue(anAuthUser('HR'));
    renderLogin();

    await signIn('  Test@HR.com ', ' test@123 ');

    await waitFor(() => expect(loginMock).toHaveBeenCalledTimes(1));
    expect(loginMock).toHaveBeenCalledWith({ email: 'test@hr.com', password: ' test@123 ' });
  });
});

describe('LoginPage - success (edge case 16)', () => {
  it('goes to /employees when there is no next', async () => {
    loginMock.mockResolvedValue(anAuthUser('HR'));
    renderLogin('/login');

    await signIn();

    await waitFor(() => expect(where()).toBe('/employees'));
  });

  it('goes to a relative next path, query included', async () => {
    loginMock.mockResolvedValue(anAuthUser('HR'));
    renderLogin(`/login?next=${encodeURIComponent('/settings/tax-tables?x=1')}`);

    await signIn();

    await waitFor(() => expect(where()).toBe('/settings/tax-tables?x=1'));
  });

  it.each([
    ['an absolute URL', 'https://evil.com'],
    ['a protocol-relative URL', '//evil.com'],
    ['a backslash trick', '/\\evil.com'],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a path without a leading slash', 'employees'],
  ])('ignores next that is %s and goes to /employees', async (_label, next) => {
    loginMock.mockResolvedValue(anAuthUser('HR'));
    renderLogin(`/login?next=${encodeURIComponent(next)}`);

    await signIn();

    await waitFor(() => expect(where()).toBe('/employees'));
  });
});

describe('LoginPage - failures (edge cases 17, 22)', () => {
  it('shows "Invalid email or password" inline on 401, clears the password and keeps the email', async () => {
    loginMock.mockRejectedValue(problem(401, 'Unauthorized', 'Invalid email or password'));
    renderLogin();

    await signIn('test@hr.com', 'wrong');

    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(password()).toHaveValue('');
    expect(await email()).toHaveValue('test@hr.com');
    expect(where()).toBe('/login');
  });

  it('shows the rate-limit message inline on 429 and clears the password', async () => {
    loginMock.mockRejectedValue(problem(429, 'Too many requests'));
    renderLogin();

    await signIn();

    expect(
      await screen.findByText('Too many sign-in attempts. Try again in a minute.'),
    ).toBeInTheDocument();
    expect(password()).toHaveValue('');
  });

  it('clears the previous error when submitting again', async () => {
    loginMock.mockRejectedValueOnce(problem(401, 'Unauthorized', 'Invalid email or password'));
    loginMock.mockResolvedValueOnce(anAuthUser('HR'));
    renderLogin();
    await signIn('test@hr.com', 'wrong');
    await screen.findByText('Invalid email or password');

    await userEvent.type(password(), 'test@123');
    await userEvent.click(submit());

    await waitFor(() => expect(where()).toBe('/employees'));
    expect(screen.queryByText('Invalid email or password')).not.toBeInTheDocument();
  });
});

describe('LoginPage - loading and signed-in visitors', () => {
  it('disables "Sign in" and marks it busy while the request is in flight', async () => {
    loginMock.mockReturnValue(new Promise(() => undefined));
    renderLogin();

    await signIn();

    await waitFor(() => expect(submit()).toBeDisabled());
    expect(submit()).toHaveAttribute('aria-busy', 'true');
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it('sends an already signed-in user to /employees (edge case 21)', async () => {
    meMock.mockResolvedValue(anAuthUser('HR'));
    renderLogin('/login');

    await waitFor(() => expect(where()).toBe('/employees'));
  });
});
