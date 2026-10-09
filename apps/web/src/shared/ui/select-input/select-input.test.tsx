import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SelectInput } from './select-input';

const options = [
  { value: 'hr', label: 'HR' },
  { value: 'emp', label: 'Employee' },
];

describe('SelectInput', () => {
  it('renders a labelled native select with options and placeholder', async () => {
    render(
      <SelectInput label="Role" options={options} placeholder="Choose role" />,
    );
    const select = screen.getByLabelText('Role');
    expect(select.tagName).toBe('SELECT');
    expect(
      screen.getByRole('option', { name: 'Choose role' }),
    ).toBeInTheDocument();
    await userEvent.selectOptions(select, 'emp');
    expect(select).toHaveValue('emp');
  });

  it('wires error to aria-invalid and aria-describedby, replacing the hint', () => {
    render(
      <SelectInput
        label="Role"
        options={options}
        hint="Pick one"
        error="Required"
      />,
    );
    const select = screen.getByLabelText('Role');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(select).toHaveAccessibleDescription('Required');
  });
});
