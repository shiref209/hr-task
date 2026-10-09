import { ProblemType, type ProblemDetails } from '@hr/types';
import axios from 'axios';

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
});

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

// Every non-2xx becomes an ApiError so callers only ever deal with one error shape.
http.interceptors.response.use(undefined, (error: unknown) =>
  Promise.reject(toApiError(error)),
);
