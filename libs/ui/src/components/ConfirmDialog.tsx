'use client';

import * as React from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

export interface ConfirmDialogProps {
  open: boolean;
  /** Called on overlay click, Escape, or the Cancel button. */
  onClose: () => void;
  onConfirm: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

/**
 * The small "confirm-dialog" variant of `Modal` — title + description +
 * Cancel/danger-confirm footer, matching the mockup's delete-confirmation
 * pattern (used for "Remove monitor" etc.).
 */
function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Remove',
  cancelLabel = 'Cancel',
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button type="button" variant="danger" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}

export { ConfirmDialog };
