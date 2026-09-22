'use client';

import * as React from 'react';
import { ToastContext } from './ToastProvider';

/**
 * Returns `toast({ type, title, message })`, which renders a stacked,
 * auto-dismissing toast in the bottom-right corner. Requires a
 * `<ToastProvider>` ancestor.
 */
function useToast() {
  const toast = React.useContext(ToastContext);
  if (!toast) {
    throw new Error('useToast() must be called within a <ToastProvider>.');
  }
  return toast;
}

export { useToast };
