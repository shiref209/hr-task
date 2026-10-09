import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders children with the tone modifier', () => {
    render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText('Active')).toHaveClass('badge--success');
  });

  it('defaults to neutral', () => {
    render(<Badge>HR</Badge>);
    expect(screen.getByText('HR')).toHaveClass('badge--neutral');
  });
});
