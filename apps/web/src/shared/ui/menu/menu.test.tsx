import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu } from './menu';

function setup() {
  const onEdit = vi.fn();
  const onRestore = vi.fn();
  render(
    <div>
      <button type="button">outside</button>
      <Menu
        label="Actions for Ahmed Zaki"
        items={[
          { label: 'Edit', onSelect: onEdit },
          { label: 'Restore', onSelect: onRestore },
          { label: 'Delete', onSelect: vi.fn() },
        ]}
      />
    </div>,
  );
  const trigger = screen.getByRole('button', { name: 'Actions for Ahmed Zaki' });
  return { trigger, onEdit, onRestore };
}

describe('Menu', () => {
  it('has a collapsed trigger with menu semantics and no menu rendered', () => {
    const { trigger } = setup();
    expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click and lists the items as menuitems', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent),
    ).toEqual(['Edit', 'Restore', 'Delete']);
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveFocus();
  });

  it('closes on an outside click', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('moves focus between items with the arrow keys', async () => {
    const { trigger } = setup();
    await userEvent.click(trigger);
    const items = screen.getAllByRole('menuitem');

    await userEvent.keyboard('{ArrowDown}');
    const first = document.activeElement;
    expect(items).toContain(first);

    await userEvent.keyboard('{ArrowDown}');
    const second = document.activeElement;
    expect(items).toContain(second);
    expect(second).not.toBe(first);
    expect(items.indexOf(second as HTMLElement)).toBe(
      items.indexOf(first as HTMLElement) + 1,
    );

    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(first);
  });

  it('calls the selected item handler once and closes', async () => {
    const { trigger, onEdit, onRestore } = setup();
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('menuitem', { name: 'Restore' }));

    expect(onRestore).toHaveBeenCalledTimes(1);
    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  describe('keyboard open on a closed trigger', () => {
    it.each([['{ArrowDown}'], ['{Enter}'], [' ']])(
      'opens with %s and focuses the first item',
      async (key) => {
        const { trigger } = setup();
        trigger.focus();
        await userEvent.keyboard(key);

        expect(screen.getByRole('menu')).toBeInTheDocument();
        expect(screen.getAllByRole('menuitem')[0]).toHaveFocus();
      },
    );

    it('opens with ArrowUp and focuses the last item', async () => {
      const { trigger } = setup();
      trigger.focus();
      await userEvent.keyboard('{ArrowUp}');

      expect(screen.getByRole('menu')).toBeInTheDocument();
      expect(screen.getAllByRole('menuitem').at(-1)).toHaveFocus();
    });
  });
});
