import * as React from 'react';
import { cn } from '../lib/cn';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

export interface ToastProps extends ToastData {
  onDismiss: (id: string) => void;
}

const iconColorClasses: Record<ToastType, string> = {
  success: 'text-green',
  error: 'text-red',
  info: 'text-blue',
};

function ToastIcon({ type }: { type: ToastType }) {
  const shared = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  if (type === 'success') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    );
  }
  if (type === 'error') {
    return (
      <svg {...shared}>
        <circle cx="12" cy="12" r="10" />
        <path d="m15 9-6 6M9 9l6 6" />
      </svg>
    );
  }
  return (
    <svg {...shared}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  );
}

/**
 * A single stacked toast. Rendered by `ToastProvider` — consumers fire these
 * via `useToast()`, they don't render `Toast` directly.
 */
function Toast({ id, type, title, message, onDismiss }: ToastProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex w-full min-w-[280px] max-w-[360px] items-start gap-2.5 rounded border border-border bg-bg p-3 px-4 shadow-lg',
        'animate-[toast-in_0.2s_ease-out]'
      )}
    >
      <span className={cn('mt-0.5 shrink-0', iconColorClasses[type])} aria-hidden="true">
        <ToastIcon type={type} />
      </span>
      <div className="flex-1">
        <div className="text-[13px] font-semibold leading-tight text-text">{title}</div>
        {message ? <div className="mt-0.5 text-xs text-text-muted">{message}</div> : null}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => onDismiss(id)}
        className="shrink-0 text-text-subtle transition-colors hover:text-text"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export { Toast, ToastIcon };
