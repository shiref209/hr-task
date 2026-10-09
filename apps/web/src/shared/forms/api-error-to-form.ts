import { toApiError, type ApiError } from '../http/http-client';
import type { ToastInput } from '../ui/toast/toast-context';

export interface ServerFormErrors {
  fieldErrors: Record<string, string>;
  formError?: string;
}

/** `conflictField` is the field a 409 (duplicate) belongs to. */
export function apiErrorToForm({ status, problem, message }: ApiError, conflictField = 'email'): ServerFormErrors {
  if (status === 409) return { fieldErrors: { [conflictField]: message } };
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

interface SaveOptions {
  toast: { show: (toast: ToastInput) => void };
  failureTitle: string;
  conflictField?: string;
}

/** Runs a save; a failure comes back as form errors, or as a toast when the form has nowhere to show it. */
export async function saveOrMapErrors(
  save: () => Promise<void>,
  { toast, failureTitle, conflictField }: SaveOptions,
): Promise<ServerFormErrors | undefined> {
  try {
    await save();
    return undefined;
  } catch (cause) {
    const error = toApiError(cause);
    const mapped = apiErrorToForm(error, conflictField);
    if (Object.keys(mapped.fieldErrors).length === 0 && !mapped.formError) {
      toast.show({ variant: 'error', title: failureTitle, description: error.message });
    }
    return mapped;
  }
}
