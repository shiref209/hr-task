import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ToastContext, type ToastInput, type ToastItem } from './toast-context';
import './toast.scss';

const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const show = useCallback((toast: ToastInput) => {
    nextId.current += 1;
    const item = { ...toast, id: nextId.current };
    setToasts((current) => [...current, item].slice(-MAX_VISIBLE));
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((current) => current.filter((t) => t.id !== id)),
    [],
  );
  const value = useMemo(() => ({ show }), [show]);

  const renderRegion = (live: 'polite' | 'assertive', items: ToastItem[]) => (
    <div
      className="toast-region__list"
      aria-live={live}
      role={live === 'polite' ? 'status' : 'alert'}
    >
      {items.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );

  return (
    <ToastContext value={value}>
      {children}
      <div className="toast-region">
        {renderRegion(
          'polite',
          toasts.filter((t) => t.variant !== 'error'),
        )}
        {renderRegion(
          'assertive',
          toasts.filter((t) => t.variant === 'error'),
        )}
      </div>
    </ToastContext>
  );
}

function ToastMessage({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const { id, variant } = toast;
  useEffect(() => {
    if (variant === 'error') return;
    const timer = setTimeout(() => onDismiss(id), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [id, variant, onDismiss]);

  return (
    <div className={`toast toast--${variant}`}>
      <div className="toast__body">
        <p className="toast__title">{toast.title}</p>
        {toast.description ? (
          <p className="toast__description">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        className="toast__dismiss"
        aria-label="Dismiss notification"
        onClick={() => onDismiss(id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </div>
  );
}
