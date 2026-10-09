import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Card } from './card';

describe('Card', () => {
  it('is a named region with a heading when titled', () => {
    render(
      <Card title="Payroll" actions={<button>Edit</button>} footer="Updated">
        body
      </Card>,
    );
    expect(screen.getByRole('region', { name: 'Payroll' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Payroll' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByText('Updated')).toBeInTheDocument();
    expect(screen.getByText('body')).toBeInTheDocument();
  });

  it('has no heading when untitled', () => {
    render(<Card>body</Card>);
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
  });
});
