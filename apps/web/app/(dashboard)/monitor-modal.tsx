'use client';

import { useEffect, useState } from 'react';
import { Modal, Button, Input, useToast } from '@uptime/ui';
import { apiFetch } from '../../lib/api-client';
import type { MonitorWithStatus } from '../../lib/types';

// Mirrors apps/api's MonitorsService normalize/validate logic — real-time
// client-side feedback, not the actual security boundary (that's server-side).
const HOSTNAME_REGEX = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

function normalizeDomain(input: string): string {
  return input.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function isValidDomain(domain: string): boolean {
  if (!domain) return false;
  try {
    return HOSTNAME_REGEX.test(new URL(`https://${domain}`).hostname);
  } catch {
    return false;
  }
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function MonitorModal({
  open,
  onClose,
  onSaved,
  editingMonitor,
  monitors,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** `null` = add mode, otherwise edit mode for this monitor. */
  editingMonitor: MonitorWithStatus | null;
  /** Full monitor list, for duplicate-URL detection (the monitor being edited is excluded automatically). */
  monitors: MonitorWithStatus[];
}) {
  const isEdit = editingMonitor !== null;
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setUrl(editingMonitor?.domain ?? '');
    setLabel(editingMonitor?.label ?? '');
  }, [open, editingMonitor]);

  const urlTouched = url.trim().length > 0;
  const normalized = normalizeDomain(url);
  const formatValid = urlTouched && isValidDomain(normalized);
  const isDuplicate =
    formatValid &&
    monitors.some((m) => m.id !== editingMonitor?.id && m.domain.toLowerCase() === normalized.toLowerCase());
  const urlValid = formatValid && !isDuplicate;

  function reset() {
    setUrl('');
    setLabel('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit() {
    if (!urlValid) return;

    setSubmitting(true);
    try {
      if (isEdit) {
        await apiFetch(`monitors/${editingMonitor!.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ domain: normalized, label: label.trim() }),
        });
        toast({ type: 'success', title: 'Monitor updated', message: label.trim() || normalized });
      } else {
        await apiFetch('monitors', {
          method: 'POST',
          body: JSON.stringify({ domain: normalized, label: label.trim() || undefined }),
        });
        toast({ type: 'success', title: 'Monitor added', message: `Now watching ${normalized}` });
      }
      reset();
      onClose();
      onSaved();
    } catch (err) {
      toast({
        type: 'error',
        title: isEdit ? 'Could not update monitor' : 'Could not add monitor',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  const urlErrorMessage = !formatValid
    ? 'Enter a valid URL, e.g. example.com'
    : isDuplicate
      ? 'A monitor for this URL already exists'
      : null;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit monitor' : 'Add monitor'}
      description={
        isEdit ? "Update this monitor's URL or label" : 'Start checking a URL every 60 seconds from the worker server'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={submitting || !urlValid}>
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add monitor'}
          </Button>
        </>
      }
    >
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          URL <span className="text-red">*</span>
        </label>
        <div className="relative">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="example.com"
            autoComplete="off"
            autoFocus
            className={urlTouched ? (urlValid ? 'pr-8' : 'pr-8 border-red') : undefined}
            aria-invalid={urlTouched && !urlValid}
          />
          {urlTouched ? (
            <span
              className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${urlValid ? 'text-green' : 'text-red'}`}
              aria-hidden="true"
            >
              {urlValid ? <CheckIcon /> : <CrossIcon />}
            </span>
          ) : null}
        </div>
        <div className={`mt-1 text-xs ${urlTouched && urlErrorMessage ? 'text-red' : 'text-text-muted'}`}>
          {urlTouched && urlErrorMessage ? urlErrorMessage : "No need to type https:// — it's added automatically"}
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Label <span className="font-normal text-text-subtle">(optional)</span>
        </label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Client website name" />
      </div>
    </Modal>
  );
}
