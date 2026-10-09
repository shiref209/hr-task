import { ProblemType, type ProblemDetails } from '@hr/types';
import { describe, expect, it } from 'vitest';
import { ApiError, http, resolveAssetUrl, toApiError } from './http-client';

const axiosLike = (extra: Record<string, unknown>) =>
  Object.assign(new Error('axios failure'), { isAxiosError: true, ...extra });

describe('toApiError', () => {
  it('carries the problem+json body of an error response', () => {
    const problem: ProblemDetails = {
      type: ProblemType.conflict,
      title: 'Conflict',
      status: 409,
      detail: 'Employee is not deleted',
    };
    const error = axiosLike({
      response: {
        status: 409,
        data: problem,
        headers: { 'content-type': 'application/problem+json' },
      },
    });

    const result = toApiError(error);

    expect(result).toBeInstanceOf(ApiError);
    expect(result).toBeInstanceOf(Error);
    expect(result.status).toBe(409);
    expect(result.problem).toEqual(problem);
  });

  it('maps a missing response (network failure) to status 0 and "Network error"', () => {
    const result = toApiError(axiosLike({ response: undefined }));

    expect(result.status).toBe(0);
    expect(result.problem.title).toBe('Network error');
  });

  it('maps an unknown thrown value to a generic 500 problem', () => {
    const result = toApiError('boom');

    expect(result).toBeInstanceOf(ApiError);
    expect(result.status).toBe(500);
    expect(result.problem.status).toBe(500);
    expect(result.problem.title).not.toBe('');
  });

  it('returns an ApiError unchanged', () => {
    const original = toApiError('boom');
    expect(toApiError(original)).toBe(original);
  });
});

describe('resolveAssetUrl', () => {
  const base = http.defaults.baseURL ?? '';

  it('returns undefined for null', () => {
    expect(resolveAssetUrl(null)).toBeUndefined();
  });

  it('keeps absolute http and https URLs unchanged', () => {
    expect(resolveAssetUrl('http://cdn.test/a.png')).toBe('http://cdn.test/a.png');
    expect(resolveAssetUrl('https://cdn.test/a.png')).toBe('https://cdn.test/a.png');
  });

  it('resolves a relative path against the API base URL', () => {
    expect(resolveAssetUrl('/uploads/employees/x.png')).toBe(`${base}/uploads/employees/x.png`);
  });

  it('does not double the slash when the base URL ends with one', () => {
    const original = http.defaults.baseURL;
    http.defaults.baseURL = 'http://api.test/';
    try {
      expect(resolveAssetUrl('/uploads/x.png')).toBe('http://api.test/uploads/x.png');
    } finally {
      http.defaults.baseURL = original;
    }
  });
});
