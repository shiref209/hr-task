import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(cleanup);

// jsdom lacks <dialog> modal behaviour; mimic open/close, the `close` event and focus restore.
let opener: Element | null = null;
HTMLDialogElement.prototype.showModal = function showModal() {
  opener = document.activeElement;
  this.setAttribute('open', '');
};
HTMLDialogElement.prototype.close = function close() {
  this.removeAttribute('open');
  // Native <dialog> restores focus on close itself; this only polyfills it, so the confirm-dialog focus test verifies opener wiring only.
  if (opener instanceof HTMLElement) opener.focus();
  this.dispatchEvent(new Event('close'));
};
