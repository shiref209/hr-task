import { useEffect, useId, useRef, type SyntheticEvent } from 'react';
import { Button } from '../button/button';
import './confirm-dialog.scss';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'default' | 'danger';
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'default',
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Let the parent own `open`; the effect above closes the dialog.
  const handleCancel = (event: SyntheticEvent) => {
    event.preventDefault();
    if (!isConfirming) onCancel();
  };

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={handleCancel}
    >
      <div className="confirm-dialog__content">
        <h2 id={titleId} className="confirm-dialog__title">
          {title}
        </h2>
        <p id={descriptionId} className="confirm-dialog__description">
          {description}
        </p>
        <div className="confirm-dialog__actions">
          <Button
            variant="secondary"
            onClick={onCancel}
            disabled={isConfirming}
          >
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isConfirming}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
