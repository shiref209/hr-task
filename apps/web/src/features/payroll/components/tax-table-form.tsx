import { taxTableInputSchema, type TaxTableInput } from '@hr/types';
import { useEffect, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Path } from 'react-hook-form';
import { Button, TextInput } from '../../../shared/ui';
import type { ServerFormErrors } from '../../employees/form/api-error-to-form';
import { schemaResolver } from '../form/schema-resolver';
import { toInput, type TaxTableFormValues } from '../form/tax-table-values';
import { useFormatOnBlur } from '../form/use-format-on-blur';

interface TaxTableFormProps {
  id: string;
  initial: TaxTableFormValues;
  isSaving: boolean;
  onSubmit: (input: TaxTableInput) => Promise<ServerFormErrors | undefined>;
  onDirtyChange: (dirty: boolean) => void;
}

const resolver = schemaResolver<TaxTableFormValues>(taxTableInputSchema, toInput);
const isFormField = (name: string): name is Path<TaxTableFormValues> =>
  /^(name|brackets\.\d+\.(upTo|rate))$/.test(name);

export function TaxTableForm({ id, initial, isSaving, onSubmit, onDirtyChange }: TaxTableFormProps) {
  const [formError, setFormError] = useState<string>();
  const alertRef = useRef<HTMLParagraphElement>(null);
  const form = useForm<TaxTableFormValues>({ defaultValues: initial, resolver, mode: 'onBlur' });
  const { register, control, handleSubmit, setError, setFocus, getValues, formState: { errors } } = form;
  const { fields, insert, remove } = useFieldArray({ control, name: 'brackets' });
  const formatOnBlur = useFormatOnBlur(form);

  useWatch({ control }); // re-renders on every edit so `dirty` below stays current
  const dirty = JSON.stringify(toInput(getValues())) !== JSON.stringify(toInput(initial));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => setFocus('name'), [setFocus]);
  useEffect(() => alertRef.current?.focus(), [formError]);

  const submit = handleSubmit(async (values) => {
    if (isSaving) return;
    setFormError(undefined);
    const failure = await onSubmit(toInput(values));
    if (!failure) return;
    for (const [name, message] of Object.entries(failure.fieldErrors)) {
      if (isFormField(name)) setError(name, { type: 'server', message }, { shouldFocus: true });
    }
    setFormError(failure.formError);
  });

  const lastIndex = fields.length - 1;

  return (
    <form id={id} className="tax-table-form" onSubmit={submit} noValidate>
      <TextInput label="Name" required error={errors.name?.message} {...register('name')} />
      <p className="tax-table-form__hint">
        Each rate applies only to the part of the salary inside its bracket. Example: up to 10,000.00 at 0%,
        up to 20,000.00 at 10%, everything above at 15%.
      </p>
      {fields.map((field, index) => {
        const n = index + 1;
        const isOpen = index === lastIndex;
        const rowErrors = errors.brackets?.[index];
        const from = index === 0 ? '0.00' : getValues(`brackets.${index - 1}.upTo`).trim() || 'the previous limit';
        const range = !isOpen ? `from ${from}` : index === 0 ? 'any amount' : `above ${from}`;
        return (
          <fieldset key={field.id} className="tax-table-form__bracket">
            <legend className="tax-table-form__legend">{`Bracket ${n}: ${range}`}</legend>
            <div className="tax-table-form__row">
              {isOpen ? (
                <div className="tax-table-form__open-limit">
                  Up to amount
                  <span className="tax-table-form__open-limit-value">No limit</span>
                </div>
              ) : (
                <TextInput
                  label="Up to amount"
                  inputMode="decimal"
                  required
                  error={rowErrors?.upTo?.message}
                  {...register(`brackets.${index}.upTo`)}
                  onBlurCapture={formatOnBlur(`brackets.${index}.upTo`)}
                />
              )}
              <TextInput
                label="Tax rate %"
                inputMode="decimal"
                required
                error={rowErrors?.rate?.message}
                {...register(`brackets.${index}.rate`)}
                onBlurCapture={formatOnBlur(`brackets.${index}.rate`)}
              />
              {isOpen ? null : (
                <Button
                  variant="ghost"
                  className="tax-table-form__remove"
                  aria-label={`Remove bracket ${n}`}
                  onClick={() => remove(index)}
                >
                  <span aria-hidden="true">✕</span>
                </Button>
              )}
            </div>
          </fieldset>
        );
      })}
      <div>
        <Button variant="secondary" onClick={() => insert(lastIndex, { upTo: '', rate: '' })}>
          Add bracket
        </Button>
      </div>
      {formError ? (
        <p ref={alertRef} className="tax-table-form__alert" role="alert" tabIndex={-1}>
          {formError}
        </p>
      ) : null}
    </form>
  );
}
