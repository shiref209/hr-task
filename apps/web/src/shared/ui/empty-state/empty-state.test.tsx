import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="No employees"
        description="Try another search"
        action={<button>Clear</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'No employees' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Try another search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('renders only the title when nothing else is given', () => {
    render(<EmptyState title="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
