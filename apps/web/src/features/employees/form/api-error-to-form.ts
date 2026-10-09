import type { ApiError } from '../../../shared/http/http-client';

export interface ServerFormErrors {
  fieldErrors: Record<string, string>;
  formError?: string;
}

export function apiErrorToForm({ status, problem }: ApiError): ServerFormErrors {
  const message = problem.detail ?? problem.title;
  if (status === 409) return { fieldErrors: { email: message } };
  if (status === 422) return { fieldErrors: {}, formError: message };
  if (status === 400 && problem.errors) {
    const fieldErrors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(problem.errors)) {
      const first = messages[0];
      if (first !== undefined) fieldErrors[field] = first;
    }
    return { fieldErrors };
  }
  return { fieldErrors: {} };
}
