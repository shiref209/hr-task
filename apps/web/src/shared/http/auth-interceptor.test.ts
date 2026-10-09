import { ProblemType } from '@hr/types';
import {
  AxiosError,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, http, setSessionExpiredHandler } from './http-client';

/**
 * Assumed contract (specs/auth/spec.md, "Web: decisions and contract"):
 *   export function setSessionExpiredHandler(handler: (currentPath: string) => void): void
 * `currentPath` is pathname + search of the page when the refresh failed.
 */

type Reply = { status: number; data?: unknown };
type Handler = (config: InternalAxiosRequestConfig) => Reply | Promise<Reply>;

const PROBLEM_JSON = { 'content-type': 'application/problem+json' };
const unauthorized: Reply = {
  status: 401,
  data: { type: ProblemType.unauthorized, title: 'Unauthorized', status: 401 },
};

const originalAdapter = http.defaults.adapter;
let calls: InternalAxiosRequestConfig[];
const urlsCalled = () => calls.map((c) => `${c.method?.toUpperCase()} ${c.url}`);
const refreshCalls = () => calls.filter((c) => c.url === '/auth/refresh');

function useServer(handler: Handler) {
  const adapter: AxiosAdapter = async (config) => {
    calls.push(config);
    const { status, data = {} } = await handler(config);
    const response = { data, status, statusText: '', headers: PROBLEM_JSON, config };
    if (status >= 400) {
      throw new AxiosError('failed', String(status), config, null, response);
    }
    return response;
  };
  http.defaults.adapter = adapter;
}

const onSessionExpired = vi.fn<(currentPath: string) => void>();

beforeEach(() => {
  calls = [];
  onSessionExpired.mockReset();
  setSessionExpiredHandler(onSessionExpired);
  window.history.replaceState(null, '', '/employees?page=2');
});

afterEach(() => {
  http.defaults.adapter = originalAdapter;
});

describe('http client - request defaults (edge case: CSRF header)', () => {
  it('sends cookies with every request (withCredentials)', async () => {
    useServer(() => ({ status: 200 }));

    await http.get('/employees');

    expect(calls[0]?.withCredentials).toBe(true);
  });

  it.each(['post', 'put', 'patch', 'delete'] as const)(
    'adds X-Requested-With: hr-payroll to %s requests',
    async (method) => {
      useServer(() => ({ status: 200 }));

      await http.request({ url: '/employees/1', method });

      expect(calls[0]?.headers.get('X-Requested-With')).toBe('hr-payroll');
    },
  );
});

describe('http client - 401 refresh and retry (edge cases 19, 20)', () => {
  it('refreshes once with POST /auth/refresh, then retries the original request', async () => {
    let refreshed = false;
    useServer((config) => {
      if (config.url === '/auth/refresh') {
        refreshed = true;
        return { status: 200, data: { user: {} } };
      }
      return refreshed ? { status: 200, data: { data: 'ok' } } : unauthorized;
    });

    const response = await http.get('/employees');

    expect(response.data).toEqual({ data: 'ok' });
    expect(urlsCalled()).toEqual(['GET /employees', 'POST /auth/refresh', 'GET /employees']);
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  it('sends the CSRF header on the refresh call', async () => {
    let refreshed = false;
    useServer((config) => {
      if (config.url === '/auth/refresh') {
        refreshed = true;
        return { status: 200 };
      }
      return refreshed ? { status: 200 } : unauthorized;
    });

    await http.get('/employees');

    expect(refreshCalls()[0]?.headers.get('X-Requested-With')).toBe('hr-payroll');
  });

  it('shares one in-flight refresh between concurrent 401s and retries all of them', async () => {
    let refreshed = false;
    useServer(async (config) => {
      if (config.url === '/auth/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 10));
        refreshed = true;
        return { status: 200 };
      }
      return refreshed ? { status: 200, data: config.url } : unauthorized;
    });

    const results = await Promise.all([
      http.get('/employees'),
      http.get('/departments'),
      http.get('/me/tax-table'),
    ]);

    expect(results.map((r) => r.data)).toEqual(['/employees', '/departments', '/me/tax-table']);
    expect(refreshCalls()).toHaveLength(1);
    expect(calls).toHaveLength(7); // 3 first tries + 1 refresh + 3 retries
  });

  it('retries only once: a second 401 after a successful refresh is surfaced as an ApiError', async () => {
    useServer((config) => (config.url === '/auth/refresh' ? { status: 200 } : unauthorized));

    const failure = await http.get('/employees').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
    expect(urlsCalled()).toEqual(['GET /employees', 'POST /auth/refresh', 'GET /employees']);
  });

  it('calls onSessionExpired once with the current path when the refresh fails, and rejects with the 401', async () => {
    useServer(() => unauthorized);

    const failure = await http.get('/employees').catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(401);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
    expect(onSessionExpired).toHaveBeenCalledWith('/employees?page=2');
    expect(urlsCalled()).toEqual(['GET /employees', 'POST /auth/refresh']); // no loop
  });

  it('calls onSessionExpired once, with one refresh, when concurrent requests all fail', async () => {
    useServer(() => unauthorized);

    const outcomes = await Promise.allSettled([http.get('/employees'), http.get('/departments')]);

    expect(outcomes.map((o) => o.status)).toEqual(['rejected', 'rejected']);
    expect(refreshCalls()).toHaveLength(1);
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh refresh for a later 401 once the previous refresh has finished', async () => {
    let refreshes = 0;
    let fresh = false;
    useServer((config) => {
      if (config.url === '/auth/refresh') {
        refreshes += 1;
        fresh = true;
        return { status: 200 };
      }
      if (fresh) {
        fresh = false; // the next call after a refresh succeeds, the one after that expires again
        return { status: 200 };
      }
      return unauthorized;
    });

    await http.get('/employees');
    await http.get('/employees');

    expect(refreshes).toBe(2);
  });
});

describe('http client - /auth/* never refreshes', () => {
  it.each(['/auth/login', '/auth/refresh', '/auth/me', '/auth/logout'])(
    'a 401 on %s is surfaced as is, without a refresh',
    async (url) => {
      useServer(() => unauthorized);

      const failure = await http.post(url).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(ApiError);
      expect((failure as ApiError).status).toBe(401);
      expect(urlsCalled()).toEqual([`POST ${url}`]);
      expect(onSessionExpired).not.toHaveBeenCalled();
    },
  );

  it('does not refresh for non-401 errors', async () => {
    useServer(() => ({
      status: 403,
      data: { type: ProblemType.forbidden, title: 'Forbidden', status: 403 },
    }));

    await expect(http.get('/tax-tables')).rejects.toMatchObject({ status: 403 });

    expect(urlsCalled()).toEqual(['GET /tax-tables']);
  });
});
