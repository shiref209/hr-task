import { render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { TextInput } from './text-input';

describe('TextInput', () => {
  it('associates the label with the input', () => {
    render(<TextInput label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('links the hint via aria-describedby', () => {
    render(<TextInput label="Email" hint="Work address" />);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Work address',
    );
  });

  it('marks the field invalid and describes it by the error', () => {
    render(<TextInput label="Email" error="Required" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required');
  });

  it('error replaces hint when both are given', () => {
    render(<TextInput label="Email" hint="Work address" error="Required" />);
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription(
      'Required',
    );
    expect(screen.queryByText('Work address')).not.toBeInTheDocument();
  });

  it('shows a required marker and sets aria-required, not native required', () => {
    render(<TextInput label="Email" required />);
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).not.toHaveAttribute('required');
  });

  it('forwards ref to the input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<TextInput label="Email" ref={ref} />);
    expect(ref.current).toBe(screen.getByLabelText('Email'));
  });
});
