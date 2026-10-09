import { ProblemType, type ApiResponse, type ProblemDetails } from '@hr/types';
import axios, { type AxiosError, type AxiosResponse } from 'axios';

declare module 'axios' {
  interface AxiosRequestConfig {
    /** Set on the one retry after a token refresh, so a second 401 is surfaced instead of looping. */
    retriedAfterRefresh?: boolean;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = problem.status;
    this.problem = problem;
  }
}

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  withCredentials: true,
});

// The API rejects state-changing requests without this header (CSRF defence for cookie auth).
http.interceptors.request.use((config) => {
  if (config.method !== 'get') config.headers.set('X-Requested-With', 'hr-payroll');
  return config;
});

/** The payload of a success envelope. */
export async function unwrap<T>(request: Promise<AxiosResponse<ApiResponse<T>>>): Promise<T> {
  const { data } = await request;
  return data.data;
}

/** Uploads are served by the API, not by the web origin; relative paths must be resolved against it. */
export function resolveAssetUrl(path: string | null): string | undefined {
  if (path === null) return undefined;
  if (/^https?:\/\//.test(path)) return path;
  const base = (http.defaults.baseURL ?? '').replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

const ABOUT_BLANK = 'about:blank';

function isProblem(value: unknown): value is ProblemDetails {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof value.title === 'string' &&
    'status' in value &&
    typeof value.status === 'number'
  );
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (axios.isAxiosError(error)) {
    const { response } = error;
    if (!response) {
      return new ApiError({ type: ABOUT_BLANK, title: 'Network error', status: 0 });
    }
    const contentType = String(response.headers?.['content-type'] ?? '');
    if (contentType.includes('problem+json') && isProblem(response.data)) {
      return new ApiError(response.data);
    }
    return new ApiError({ type: ABOUT_BLANK, title: 'Request failed', status: response.status });
  }

  return new ApiError({
    type: ProblemType.businessRuleViolation,
    title: 'Unexpected error',
    status: 500,
  });
}

let onSessionExpired: (currentPath: string) => void = () => undefined;

/** The app decides where an expired session goes (the router lives in React, not here). */
export function setSessionExpiredHandler(handler: (currentPath: string) => void): void {
  onSessionExpired = handler;
}

let refreshing: Promise<void> | undefined;

// One refresh per tab, however many requests hit a 401 at once.
function refreshSession(): Promise<void> {
  refreshing ??= http
    .post('/auth/refresh')
    .then(() => undefined)
    .catch((error: unknown) => {
      onSessionExpired(window.location.pathname + window.location.search);
      throw error;
    })
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

function isRefreshable(error: AxiosError): boolean {
  const { config } = error;
  return (
    error.response?.status === 401 &&
    config !== undefined &&
    config.retriedAfterRefresh !== true &&
    config.url?.startsWith('/auth/') !== true
  );
}

// Every non-2xx becomes an ApiError so callers only ever deal with one error shape.
http.interceptors.response.use(undefined, async (error: unknown) => {
  if (axios.isAxiosError(error) && error.config && isRefreshable(error)) {
    try {
      await refreshSession();
    } catch {
      throw toApiError(error);
    }
    return http.request({ ...error.config, retriedAfterRefresh: true });
  }
  throw toApiError(error);
});
