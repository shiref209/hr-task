import { socialInsuranceSchema, type SocialInsurance } from '@hr/types';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button, TextInput } from '../../../shared/ui';
import type { ServerFormErrors } from '../../employees/form/api-error-to-form';
import { schemaResolver } from '../form/schema-resolver';
import { toFormValues, toInput, type SocialInsuranceFormValues } from '../form/social-insurance-values';
import { useFormatOnBlur } from '../form/use-format-on-blur';

interface SocialInsuranceFormProps {
  initial: SocialInsurance;
  isSaving: boolean;
  onSubmit: (input: SocialInsurance) => Promise<ServerFormErrors | undefined>;
}

const resolver = schemaResolver<SocialInsuranceFormValues>(socialInsuranceSchema, toInput);

export function SocialInsuranceForm({ initial, isSaving, onSubmit }: SocialInsuranceFormProps) {
  const [formError, setFormError] = useState<string>();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<SocialInsuranceFormValues>({
    defaultValues: toFormValues(initial),
    resolver,
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, setError, getValues, formState: { errors } } = form;
  const formatOnBlur = useFormatOnBlur(form);

  const capped = useWatch({ control, name: 'capped' });
  useWatch({ control }); // keeps `dirty` below current on every edit
  const dirty = JSON.stringify(toInput(getValues())) !== JSON.stringify(toInput(toFormValues(initial)));

  useEffect(() => alertRef.current?.focus(), [formError]);

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    setFormError(undefined);
    const failure = await onSubmit(toInput(values));
    if (!failure) return;
    for (const [name, message] of Object.entries(failure.fieldErrors)) {
      if (name === 'rate' || name === 'cap') setError(name, { type: 'server', message }, { shouldFocus: true });
    }
    setFormError(failure.formError);
  });

  return (
    <form className="social-insurance-form" onSubmit={submit} noValidate>
      <TextInput
        label="Rate %"
        inputMode="decimal"
        required
        error={errors.rate?.message}
        {...register('rate')}
        // Capture phase: the registered onBlur stays free for react-hook-form's own validation.
        onBlurCapture={formatOnBlur('rate')}
      />
      <label className="social-insurance-form__toggle">
        <input type="checkbox" {...register('capped')} />
        Cap the monthly contribution
      </label>
      {capped ? (
        <TextInput
          label="Cap"
          inputMode="decimal"
          required
          error={errors.cap?.message}
          {...register('cap')}
          onBlurCapture={formatOnBlur('cap')}
        />
      ) : null}
      {formError ? (
        <p ref={alertRef} className="social-insurance-form__alert" role="alert" tabIndex={-1}>
          {formError}
        </p>
      ) : null}
      <div className="social-insurance-form__actions">
        <Button type="submit" disabled={!dirty} isLoading={isSaving}>
          Save
        </Button>
      </div>
    </form>
  );
}
