import { useState } from 'react';
import { ConfirmDialog } from '../ui';

interface DiscardGuardOptions {
  dirty: boolean;
  isSaving: boolean;
  onClose: () => void;
}

/** Closing with unsaved changes asks first; render `discardDialog` next to the drawer. */
export function useDiscardGuard({ dirty, isSaving, onClose }: DiscardGuardOptions) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const requestClose = () => {
    if (isSaving) return;
    if (dirty) setConfirmingDiscard(true);
    else onClose();
  };

  const discard = () => {
    setConfirmingDiscard(false);
    onClose();
  };

  const discardDialog = (
    <ConfirmDialog
      open={confirmingDiscard}
      title="Discard unsaved changes?"
      description="Your changes will be lost."
      confirmLabel="Discard"
      cancelLabel="Keep editing"
      tone="danger"
      onConfirm={discard}
      onCancel={() => setConfirmingDiscard(false)}
    />
  );

  return { requestClose, discardDialog };
}
