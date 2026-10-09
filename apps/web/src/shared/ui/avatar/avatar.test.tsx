import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Avatar } from './avatar';
import { initialsOf } from './initials-of';

describe('initialsOf', () => {
  it.each([
    ['Mona Ali Hassan', 'MH'],
    ['mona ali', 'MA'],
    ['  Mona  ', 'M'],
    ['', ''],
    ['   ', ''],
  ])('%j -> %j', (name, expected) => {
    expect(initialsOf(name)).toBe(expected);
  });
});

describe('Avatar', () => {
  it('renders the image with alt = name', () => {
    render(<Avatar name="Mona Ali" src="/a.png" />);
    expect(screen.getByRole('img', { name: 'Mona Ali' })).toHaveAttribute(
      'src',
      '/a.png',
    );
  });

  it('falls back to initials without src', () => {
    render(<Avatar name="Mona Ali Hassan" />);
    expect(
      screen.getByRole('img', { name: 'Mona Ali Hassan' }),
    ).toHaveTextContent('MH');
  });

  it('falls back to initials when the image fails to load', () => {
    render(<Avatar name="Mona Ali" src="/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Mona Ali' }));
    expect(screen.getByRole('img', { name: 'Mona Ali' })).toHaveTextContent(
      'MA',
    );
    expect(document.querySelector('img')).toBeNull();
  });

  it('retries the image when src changes after a failure', () => {
    const { rerender } = render(<Avatar name="Mona Ali" src="/broken.png" />);
    fireEvent.error(screen.getByRole('img'));
    rerender(<Avatar name="Mona Ali" src="/ok.png" />);
    expect(document.querySelector('img')).toHaveAttribute('src', '/ok.png');
  });

  it('shows a generic placeholder for an empty name', () => {
    render(<Avatar name="   " />);
    expect(
      screen.getByRole('img', { name: 'Unknown user' }),
    ).toBeInTheDocument();
  });
});
