import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import './menu.scss';

interface MenuItem {
  label: string;
  onSelect: () => void;
  tone?: 'danger';
}

interface MenuProps {
  label: string;
  items: MenuItem[];
}

export function Menu({ label, items }: MenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', closeOnOutside);
    return () => document.removeEventListener('pointerdown', closeOnOutside);
  }, [open]);

  const focusOnOpen = useRef<'first' | 'last'>(undefined);

  useEffect(() => {
    if (!open || !focusOnOpen.current) return;
    const entries = rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    (focusOnOpen.current === 'first' ? entries?.[0] : entries?.[entries.length - 1])?.focus();
    focusOnOpen.current = undefined;
  }, [open]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    if (!open) {
      focusOnOpen.current = event.key === 'ArrowDown' ? 'first' : 'last';
      setOpen(true);
      return;
    }
    const entries = Array.from(
      rootRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const current = entries.findIndex((entry) => entry === document.activeElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    // From the trigger (current -1): ArrowDown lands on the first item, ArrowUp on the last.
    const next = current === -1 ? (step === 1 ? 0 : entries.length - 1) : current + step;
    entries[(next + entries.length) % entries.length]?.focus();
  };

  return (
    <div className="menu" ref={rootRef} onKeyDown={onKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          // detail 0 = keyboard-initiated click (Enter/Space): land on the first item.
          if (!open && event.detail === 0) focusOnOpen.current = 'first';
          setOpen((current) => !current);
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div id={menuId} role="menu" aria-label={label} className="menu__list">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={item.tone ? `menu__item menu__item--${item.tone}` : 'menu__item'}
              onClick={() => {
                item.onSelect();
                close();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
