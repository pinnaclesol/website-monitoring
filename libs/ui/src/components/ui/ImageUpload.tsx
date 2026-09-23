'use client';

import * as React from 'react';
import { Button } from './Button';
import { useToast } from '../use-toast';

const MAX_SIZE_MB = 2;
const ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon,image/vnd.microsoft.icon';

function ImagePlaceholderIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}
function SpinnerIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="animate-spin text-text-muted" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export interface ImageUploadProps {
  label: string;
  hint?: string;
  /** Current image URL (a `/uploads/<file>` path, or `null` if unset). */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

/**
 * Shared favicon/logo upload widget — one component, used for both fields
 * on the Settings page. Uploads to apps/web's own local `/api/upload` route
 * (never `apiFetch`, which forces `Content-Type: application/json` and
 * would break the multipart boundary). Only stages the returned URL via
 * `onChange` — persisting it is the page's job (its own "Save settings").
 */
export function ImageUpload({ label, hint, value, onChange, disabled }: ImageUploadProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const toast = useToast();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so re-picking the same file still fires a change
    if (!file) return;

    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      toast({ type: 'error', title: `Image must be ${MAX_SIZE_MB}MB or smaller` });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (value) formData.append('previousUrl', value);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || `Upload failed (${res.status})`);
      }
      const { url } = (await res.json()) as { url: string };
      onChange(url);
    } catch (err) {
      toast({ type: 'error', title: 'Could not upload image', message: err instanceof Error ? err.message : undefined });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-medium text-text">{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-bg-secondary text-text-subtle">
          {uploading ? (
            <SpinnerIcon />
          ) : value ? (
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlaceholderIcon />
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? 'Replace image' : 'Choose image'}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="p-1.5 text-text-muted hover:text-text"
                disabled={disabled || uploading}
                title="Remove image"
                aria-label="Remove image"
                onClick={() => onChange(null)}
              >
                <TrashIcon />
              </Button>
            ) : null}
          </div>
          {hint ? <span className="text-xs text-text-subtle">{hint}</span> : null}
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || uploading}
      />
    </div>
  );
}
