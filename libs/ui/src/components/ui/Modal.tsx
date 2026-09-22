'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Right-aligned action buttons, rendered below a top divider. */
  footer?: React.ReactNode;
  /** `default` = 440px (the mockup's `.modal`), `sm` = 360px (`.confirm-dialog`). */
  size?: 'default' | 'sm';
  className?: string;
}

const sizeClasses: Record<NonNullable<ModalProps['size']>, string> = {
  default: 'max-w-[440px] p-6',
  sm: 'max-w-[360px] p-5',
};

/**
 * Generic overlay + dialog shell, portaled to `document.body` so it's never
 * clipped by an ancestor's `overflow`/stacking context. Closes on overlay
 * click and Escape. Build `ConfirmDialog` and any other dialog on top of
 * this rather than hand-rolling another overlay.
 */
function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'default',
  className,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          'w-full rounded-lg border border-border bg-bg shadow-lg',
          sizeClasses[size],
          className
        )}
      >
        <div id="modal-title" className="text-base font-semibold leading-none text-text">
          {title}
        </div>
        {description ? <div className="mt-1 text-[13px] text-text-muted">{description}</div> : null}
        {children ? <div className="mt-5">{children}</div> : null}
        {footer ? (
          <div className="mt-5 flex justify-end gap-2 border-t border-border pt-4">{footer}</div>
        ) : null}
      </div>
    </div>,
    document.body
  );
}

export { Modal };
