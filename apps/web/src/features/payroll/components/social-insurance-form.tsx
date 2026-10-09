import { socialInsuranceSchema, type SocialInsurance } from '@hr/types';
import { useForm, useWatch, type Path } from 'react-hook-form';
import { Button, FormAlert, TextInput } from '../../../shared/ui';
import type { ServerFormErrors } from '../../../shared/forms/api-error-to-form';
import { schemaResolver } from '../../../shared/forms/schema-resolver';
import { toFormValues, toInput, type SocialInsuranceFormValues } from '../form/social-insurance-values';
import { useFormatOnBlur } from '../../../shared/forms/use-format-on-blur';
import { useServerFormErrors } from '../../../shared/forms/use-server-form-errors';

interface SocialInsuranceFormProps {
  initial: SocialInsurance;
  isSaving: boolean;
  onSubmit: (input: SocialInsurance) => Promise<ServerFormErrors | undefined>;
}

const resolver = schemaResolver<SocialInsuranceFormValues>(socialInsuranceSchema, toInput);
const isFormField = (name: string): name is Path<SocialInsuranceFormValues> => name === 'rate' || name === 'cap';

export function SocialInsuranceForm({ initial, isSaving, onSubmit }: SocialInsuranceFormProps) {
  const form = useForm<SocialInsuranceFormValues>({
    defaultValues: toFormValues(initial),
    resolver,
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, setError, getValues, formState: { errors } } = form;
  const formatOnBlur = useFormatOnBlur(form);
  const { formError, withServerErrors } = useServerFormErrors(setError, isFormField);

  const capped = useWatch({ control, name: 'capped' });
  useWatch({ control }); // keeps `dirty` below current on every edit
  const dirty = JSON.stringify(toInput(getValues())) !== JSON.stringify(toInput(toFormValues(initial)));

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    await withServerErrors(() => onSubmit(toInput(values)));
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
      <FormAlert message={formError} />
      <div className="social-insurance-form__actions">
        <Button type="submit" disabled={!dirty} isLoading={isSaving}>
          Save
        </Button>
      </div>
    </form>
  );
}
