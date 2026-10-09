import type { ComponentProps } from 'react';
import { Field, type FieldProps } from '../field/field';

type TextInputProps = FieldProps & Omit<ComponentProps<'input'>, 'id'>;

export function TextInput({
  label,
  hint,
  error,
  required,
  ...input
}: TextInputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <input className="field__control" {...input} {...control} />
      )}
    </Field>
  );
}
