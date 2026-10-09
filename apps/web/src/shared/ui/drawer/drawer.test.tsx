import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './drawer';

describe('Drawer', () => {
  it('is a modal dialog named by its title', () => {
    render(
      <Drawer open title="New employee" onRequestClose={vi.fn()}>
        body
      </Drawer>,
    );
    expect(screen.getByRole('dialog', { name: 'New employee' })).toBeInTheDocument();
  });

  it('is not shown when closed', () => {
    render(
      <Drawer open={false} title="New employee" onRequestClose={vi.fn()}>
        body
      </Drawer>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders its children and footer', () => {
    render(
      <Drawer open title="T" onRequestClose={vi.fn()} footer={<button>Save</button>}>
        <p>Drawer body</p>
      </Drawer>,
    );
    expect(screen.getByText('Drawer body')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('asks the parent to close from the close button without closing itself', async () => {
    const onRequestClose = vi.fn();
    render(
      <Drawer open title="T" onRequestClose={onRequestClose}>
        body
      </Drawer>,
    );
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onRequestClose).toHaveBeenCalledOnce();
    expect(screen.getByRole('dialog', { name: 'T' })).toBeInTheDocument();
  });

  it('asks the parent to close on Esc (cancel event) and prevents the native close', () => {
    const onRequestClose = vi.fn();
    render(
      <Drawer open title="T" onRequestClose={onRequestClose}>
        body
      </Drawer>,
    );
    const cancel = new Event('cancel', { cancelable: true });
    fireEvent(screen.getByRole('dialog'), cancel);
    expect(onRequestClose).toHaveBeenCalledOnce();
    expect(cancel.defaultPrevented).toBe(true);
    expect(screen.getByRole('dialog', { name: 'T' })).toBeInTheDocument();
  });

  it('returns focus to the opener on close', async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open</button>
          <Drawer open={open} title="T" onRequestClose={() => setOpen(false)}>
            body
          </Drawer>
        </>
      );
    }
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(opener).toHaveFocus();
  });
});
