import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from './skeleton';

describe('Skeleton', () => {
  it('is aria-hidden', () => {
    const { container } = render(<Skeleton variant="rect" />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders `lines` text lines inside one aria-hidden group', () => {
    const { container } = render(<Skeleton variant="text" lines={3} />);
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    expect(container.firstElementChild?.children).toHaveLength(3);
  });
});
