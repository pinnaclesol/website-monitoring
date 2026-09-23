'use client';

import { useState } from 'react';
import { Modal, Button, Input, useToast } from '@uptime/ui';
import { apiFetch } from '../../lib/api-client';

export function AddMonitorModal({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  function reset() {
    setUrl('');
    setLabel('');
  }

  async function handleAdd() {
    const domain = url.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
    if (!domain) {
      toast({ type: 'error', title: 'URL required', message: 'Please enter a URL.' });
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('monitors', {
        method: 'POST',
        body: JSON.stringify({ domain, label: label.trim() || undefined }),
      });
      toast({ type: 'success', title: 'Monitor added', message: `Now watching ${domain}` });
      reset();
      onClose();
      onAdded();
    } catch (err) {
      toast({ type: 'error', title: 'Could not add monitor', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Add monitor"
      description="Start checking a URL every 60 seconds from the worker server"
      footer={
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handleAdd} disabled={submitting}>
            {submitting ? 'Adding…' : 'Add monitor'}
          </Button>
        </>
      }
    >
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          URL <span className="text-red">*</span>
        </label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="example.com"
          autoComplete="off"
          autoFocus
        />
        <div className="mt-1 text-xs text-text-muted">No need to type https:// — it&apos;s added automatically</div>
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
