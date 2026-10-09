import { useEffect, useId, useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import './drawer.scss';

interface DrawerProps {
  open: boolean;
  title: string;
  onRequestClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export function Drawer({ open, title, onRequestClose, children, footer }: DrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  // Content mounts once the dialog is really open, so its mount effects (autofocus) run on a visible element.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    setShown(open);
  }, [open]);

  // The parent decides whether Esc may close (e.g. the unsaved-changes guard).
  const handleCancel = (event: SyntheticEvent) => {
    event.preventDefault();
    onRequestClose();
  };

  return (
    <dialog ref={dialogRef} className="drawer" aria-labelledby={titleId} onCancel={handleCancel}>
      <header className="drawer__header">
        <h2 id={titleId} className="drawer__title">
          {title}
        </h2>
        <button type="button" className="drawer__close" aria-label="Close" onClick={onRequestClose}>
          <span aria-hidden="true">✕</span>
        </button>
      </header>
      <div className="drawer__body">{shown ? children : null}</div>
      {shown && footer ? <footer className="drawer__footer">{footer}</footer> : null}
    </dialog>
  );
}
