'use client';

import { useEffect, useState } from 'react';
import {
  Modal,
  Button,
  Input,
  Toggle,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@uptime/ui';
import type { Role } from '@uptime/auth';
import { apiFetch } from '../../../lib/api-client';
import type { UserRecord } from '../../../lib/types';

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'VIEWER', label: 'Viewer' },
];

// Mirrors apps/api's CreateUserDto/UpdateUserDto password validators
// (MinLength(8), MaxLength(72) — bcrypt silently truncates beyond 72 bytes).
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72;

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

export function UserModal({
  open,
  onClose,
  onSaved,
  editingUser,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** `null` = create mode, otherwise edit mode for this user. */
  editingUser: UserRecord | null;
}) {
  const toast = useToast();
  const isEdit = editingUser !== null;

  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('VIEWER');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editingUser?.name ?? '');
    setUsername(editingUser?.username ?? '');
    setPassword('');
    setRole(editingUser?.role ?? 'VIEWER');
    setActive(editingUser?.active ?? true);
  }, [open, editingUser]);

  // Empty password in edit mode means "keep current" — only validate length
  // once something's been typed. In create mode it's always required.
  const passwordTouched = password.length > 0;
  const passwordLengthValid = password.length >= PASSWORD_MIN && password.length <= PASSWORD_MAX;
  const passwordValid = isEdit ? !passwordTouched || passwordLengthValid : passwordTouched && passwordLengthValid;

  async function handleSubmit() {
    if (!username.trim()) {
      toast({ type: 'error', title: 'Username required' });
      return;
    }
    if (!isEdit && !password.trim()) {
      toast({ type: 'error', title: 'Password required' });
      return;
    }
    if (passwordTouched && !passwordLengthValid) {
      toast({ type: 'error', title: `Password must be ${PASSWORD_MIN}–${PASSWORD_MAX} characters` });
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        const body: Record<string, unknown> = { username: username.trim(), name: name.trim() || null, role, active };
        if (password.trim()) body.password = password.trim();
        await apiFetch<UserRecord>(`users/${editingUser!.id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast({ type: 'success', title: 'User updated', message: name.trim() || username.trim() });
      } else {
        await apiFetch<UserRecord>('users', {
          method: 'POST',
          body: JSON.stringify({ username: username.trim(), name: name.trim() || undefined, password: password.trim(), role }),
        });
        toast({ type: 'success', title: 'User added', message: name.trim() || username.trim() });
      }
      onClose();
      onSaved();
    } catch (err) {
      toast({
        type: 'error',
        title: isEdit ? 'Could not update user' : 'Could not add user',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit user' : 'Add user'}
      description={isEdit ? 'Update this user’s account and role' : 'Create a new login for the dashboard'}
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !username.trim() || !passwordValid}
          >
            {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add user'}
          </Button>
        </>
      }
    >
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Name <span className="font-normal text-text-subtle">(optional)</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Doe"
          autoComplete="off"
          autoFocus
        />
        <div className="mt-1 text-xs text-text-subtle">Shown in the sidebar instead of the username. Falls back to it if left blank.</div>
      </div>
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Username <span className="text-red">*</span>
        </label>
        <Input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="jdoe"
          autoComplete="off"
        />
      </div>
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Password {isEdit ? <span className="font-normal text-text-subtle">(optional)</span> : <span className="text-red">*</span>}
        </label>
        <div className="relative">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? 'Leave blank to keep current password' : 'Choose a password'}
            autoComplete="new-password"
            maxLength={PASSWORD_MAX}
            className={passwordTouched ? (passwordLengthValid ? 'pr-8' : 'pr-8 border-red') : undefined}
            aria-invalid={passwordTouched && !passwordLengthValid}
          />
          {passwordTouched ? (
            <span
              className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 ${passwordLengthValid ? 'text-green' : 'text-red'}`}
              aria-hidden="true"
            >
              {passwordLengthValid ? <CheckIcon /> : <CrossIcon />}
            </span>
          ) : null}
        </div>
        <div className={`mt-1 text-xs ${passwordTouched && !passwordLengthValid ? 'text-red' : 'text-text-subtle'}`}>
          {password.length}/{PASSWORD_MAX} characters — minimum {PASSWORD_MIN}
        </div>
      </div>
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">Role</label>
        <Select value={role} onValueChange={(v) => setRole(v as Role)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {isEdit ? (
        <div>
          <label className="mb-1.5 block text-[13px] font-medium text-text">Active</label>
          <div className="mt-1.5 flex items-center gap-2.5">
            <Toggle checked={active} onCheckedChange={setActive} aria-label="Active" />
            <span className="text-[13px] text-text-muted">Inactive users can&rsquo;t log in</span>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
