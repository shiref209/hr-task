import { createContext, use } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';
export interface ToastInput {
  variant: ToastVariant;
  title: string;
  description?: string;
}
export interface ToastItem extends ToastInput {
  id: number;
}

export const ToastContext = createContext<{
  show: (toast: ToastInput) => void;
} | null>(null);

export function useToast() {
  const context = use(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
