import { useId, type ReactNode } from 'react';
import './field.scss';

export interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

interface ControlProps {
  id: string;
  required: boolean | undefined;
  'aria-invalid': true | undefined;
  'aria-describedby': string | undefined;
}

// Shared label/hint/error wiring for TextInput and SelectInput. Error replaces hint.
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: FieldProps & { children: (control: ControlProps) => ReactNode }) {
  const id = useId();
  const message = error ?? hint;
  const messageId = message ? `${id}-message` : undefined;

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      {children({
        id,
        required,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': messageId,
      })}
      {message ? (
        <p
          id={messageId}
          className={
            error ? 'field__message field__message--error' : 'field__message'
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
