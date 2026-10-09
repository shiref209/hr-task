import { useState } from 'react';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import type { ServerFormErrors } from './api-error-to-form';

/** Sends a submit and spreads its server errors over the form: field errors on fields, the rest in `formError`. */
export function useServerFormErrors<V extends FieldValues>(
  setError: UseFormSetError<V>,
  isFormField: (name: string) => name is Path<V>,
) {
  const [formError, setFormError] = useState<string>();

  const withServerErrors = async (send: () => Promise<ServerFormErrors | undefined>) => {
    setFormError(undefined);
    const failure = await send();
    if (!failure) return;
    for (const [name, message] of Object.entries(failure.fieldErrors)) {
      if (isFormField(name)) setError(name, { type: 'server', message }, { shouldFocus: true });
    }
    setFormError(failure.formError);
  };

  return { formError, withServerErrors };
}
