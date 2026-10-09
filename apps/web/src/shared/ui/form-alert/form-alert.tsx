import { useEffect, useRef } from 'react';
import './form-alert.scss';

/** A form-level server error; it takes focus whenever the message changes so screen readers announce it. */
export function FormAlert({ message }: { message?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => ref.current?.focus(), [message]);
  return message ? (
    <p ref={ref} className="form-alert" role="alert" tabIndex={-1}>
      {message}
    </p>
  ) : null;
}
