import type { ComponentProps } from 'react';
import { Field, type FieldProps } from '../field/field';

type SelectInputProps = FieldProps &
  Omit<ComponentProps<'select'>, 'id' | 'children'> & {
    options: { value: string; label: string }[];
    placeholder?: string;
  };

export function SelectInput({
  label,
  hint,
  error,
  required,
  options,
  placeholder,
  ...select
}: SelectInputProps) {
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      {(control) => (
        <select className="field__control field__control--select" {...select} {...control}>
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
