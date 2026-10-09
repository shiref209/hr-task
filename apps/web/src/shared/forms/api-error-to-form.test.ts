import { ProblemType } from '@hr/types';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../http/http-client';
import { apiErrorToForm } from './api-error-to-form';

const error = (status: number, extra: Record<string, unknown> = {}) =>
  new ApiError({ type: ProblemType.validationError, title: 'Problem', status, ...extra });

describe('apiErrorToForm', () => {
  it('maps a 400 errors map to field errors using the first message per field', () => {
    const result = apiErrorToForm(
      error(400, { errors: { fullName: ['Required', 'Too short'], jobTitle: ['Required'] } }),
    );
    expect(result).toEqual({
      fieldErrors: { fullName: 'Required', jobTitle: 'Required' },
    });
  });

  it('maps a 409 to the email field using the server detail', () => {
    const result = apiErrorToForm(error(409, { detail: 'Email already in use' }));
    expect(result.fieldErrors).toEqual({ email: 'Email already in use' });
    expect(result.formError).toBeUndefined();
  });

  it('maps a 422 to a form-level error with the server detail', () => {
    const result = apiErrorToForm(error(422, { detail: 'Cannot remove the last HR employee' }));
    expect(result.fieldErrors).toEqual({});
    expect(result.formError).toBe('Cannot remove the last HR employee');
  });

  it('returns nothing for a 500 so the caller toasts', () => {
    expect(apiErrorToForm(error(500))).toEqual({ fieldErrors: {} });
  });

  it('returns nothing for a network error (status 0)', () => {
    expect(apiErrorToForm(error(0))).toEqual({ fieldErrors: {} });
  });
});
