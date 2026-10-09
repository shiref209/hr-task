import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from './toast';
import { useToast, type ToastVariant } from './toast-context';

function Trigger({
  variant = 'success',
  title = 'Saved',
}: {
  variant?: ToastVariant;
  title?: string;
}) {
  const { show } = useToast();
  return (
    <button onClick={() => show({ variant, title, description: 'details' })}>
      fire
    </button>
  );
}

function setup(props?: Parameters<typeof Trigger>[0]) {
  render(
    <ToastProvider>
      <Trigger {...props} />
    </ToastProvider>,
  );
  return () => act(() => screen.getByText('fire').click());
}

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows title and description and auto-dismisses after 5s', () => {
    const fire = setup();
    fire();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('details')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4999);
    });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('keeps error toasts until dismissed, in the assertive region', () => {
    const fire = setup({ variant: 'error', title: 'Boom' });
    fire();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('Boom').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'assertive',
    );
  });

  it('puts non-error toasts in the polite region', () => {
    const fire = setup();
    fire();
    expect(screen.getByText('Saved').closest('[aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('dismisses via the dismiss button', async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger variant="error" />
      </ToastProvider>,
    );
    await user.click(screen.getByText('fire'));
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('shows the same message twice without dedupe and drops the oldest beyond 3', () => {
    const fire = setup();
    fire();
    fire();
    expect(screen.getAllByText('Saved')).toHaveLength(2);
    fire();
    fire();
    expect(screen.getAllByText('Saved')).toHaveLength(3);
  });

  it('drops the oldest toast first', () => {
    function Numbered() {
      const { show } = useToast();
      return (
        <button
          onClick={() => {
            ['one', 'two', 'three', 'four'].forEach((title) =>
              show({ variant: 'info', title }),
            );
          }}
        >
          fire
        </button>
      );
    }
    render(
      <ToastProvider>
        <Numbered />
      </ToastProvider>,
    );
    act(() => screen.getByText('fire').click());
    expect(screen.queryByText('one')).not.toBeInTheDocument();
    expect(screen.getByText('four')).toBeInTheDocument();
  });

  it('throws when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
  });
});
