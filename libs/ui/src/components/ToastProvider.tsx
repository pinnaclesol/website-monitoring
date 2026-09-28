'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { Toast, type ToastData, type ToastType } from './Toast';

export interface ToastInput {
  type: ToastType;
  title: string;
  message?: string;
  /** Overrides the default ~3.5s auto-dismiss, in ms. */
  duration?: number;
}

export type ToastContextValue = (input: ToastInput) => void;

const ToastContext = React.createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 3500;

/**
 * Mount ONCE near the root of the app (this wiring is `apps/web`'s job, not
 * this lib's — it's a two-line addition wherever the root layout lives):
 *
 *   <ToastProvider>{children}</ToastProvider>
 *
 * Any client component under it can then call `useToast()` to fire a toast.
 * Toasts stack bottom-right and auto-dismiss.
 */
function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastData[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const dismiss = React.useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const toast = React.useCallback<ToastContextValue>(
    ({ type, title, message, duration = DEFAULT_DURATION_MS }) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((current) => [...current, { id, type, title, message }]);
      window.setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {mounted
        ? createPortal(
            <div className="fixed bottom-5 right-5 z-[100] flex w-full max-w-[360px] flex-col gap-2">
              {toasts.map((t) => (
                <Toast key={t.id} {...t} onDismiss={dismiss} />
              ))}
            </div>,
            document.body
          )
        : null}
    </ToastContext.Provider>
  );
}

export { ToastProvider, ToastContext };
