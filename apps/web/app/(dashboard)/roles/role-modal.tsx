'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input, useToast } from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { PermissionRecord, RoleDetail, RoleRecord } from '../../../lib/types';

const NAME_MAX = 60;
const DESCRIPTION_MAX = 255;

export function RoleModal({
  open,
  onClose,
  onSaved,
  editingRole,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** `null` = create mode, otherwise edit mode for this role. */
  editingRole: RoleRecord | null;
}) {
  const toast = useToast();
  const isEdit = editingRole !== null;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<PermissionRecord[]>([]);
  const [permissionIds, setPermissionIds] = useState<string[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<PermissionRecord[]>('permissions')
      .then(setPermissions)
      .catch(() => setPermissions([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setName(editingRole?.name ?? '');
    setDescription(editingRole?.description ?? '');
    if (!editingRole) {
      setPermissionIds([]);
      return;
    }
    setLoadingDetail(true);
    apiFetch<RoleDetail>(`roles/${editingRole.id}`)
      .then((detail) => setPermissionIds(detail.permissionIds))
      .catch(() => setPermissionIds([]))
      .finally(() => setLoadingDetail(false));
  }, [open, editingRole]);

  const groups = useMemo(() => {
    const byResource = new Map<string, PermissionRecord[]>();
    for (const perm of permissions) {
      const list = byResource.get(perm.resource) ?? [];
      list.push(perm);
      byResource.set(perm.resource, list);
    }
    return [...byResource.entries()];
  }, [permissions]);

  const locked = editingRole?.isSystem ?? false;

  function togglePermission(id: string, checked: boolean) {
    setPermissionIds((prev) => (checked ? [...prev, id] : prev.filter((p) => p !== id)));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast({ type: 'error', title: 'Role name required' });
      return;
    }
    if (permissionIds.length === 0) {
      toast({ type: 'error', title: 'Select at least one permission' });
      return;
    }

    setSubmitting(true);
    try {
      const body = { name: name.trim(), description: description.trim() || null, permissionIds };
      if (isEdit) {
        await apiFetch<RoleRecord>(`roles/${editingRole!.id}`, { method: 'PATCH', body: JSON.stringify(body) });
        toast({ type: 'success', title: 'Role updated', message: name.trim() });
      } else {
        await apiFetch<RoleRecord>('roles', { method: 'POST', body: JSON.stringify(body) });
        toast({ type: 'success', title: 'Role added', message: name.trim() });
      }
      onClose();
      onSaved();
    } catch (err) {
      toast({
        type: 'error',
        title: isEdit ? 'Could not update role' : 'Could not add role',
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
      title={isEdit ? 'Edit role' : 'Add role'}
      description={
        locked
          ? 'The Admin role is protected and cannot be renamed or have its permissions changed'
          : 'Name this role and choose exactly what it can access'
      }
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {!locked ? (
            <Button size="sm" onClick={handleSubmit} disabled={submitting || !name.trim() || permissionIds.length === 0}>
              {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add role'}
            </Button>
          ) : null}
        </>
      }
    >
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Name <span className="text-red">*</span>
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Support"
          maxLength={NAME_MAX}
          disabled={locked}
          autoComplete="off"
          autoFocus
        />
      </div>
      <div className="mb-3.5">
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Description <span className="font-normal text-text-subtle">(optional)</span>
        </label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What this role is for"
          maxLength={DESCRIPTION_MAX}
          disabled={locked}
          autoComplete="off"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-text">
          Permissions <span className="text-red">*</span>
        </label>
        {loadingDetail || permissions.length === 0 ? (
          <div className="text-xs text-text-subtle">{loadingDetail ? 'Loading…' : 'No permissions available'}</div>
        ) : (
          <div className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-border p-3">
            {groups.map(([resource, perms]) => (
              <div key={resource}>
                <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-text-subtle">{resource}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {perms.map((perm) => (
                    <label key={perm.id} className="flex cursor-pointer items-center gap-1.5 text-[13px] text-text">
                      <input
                        type="checkbox"
                        checked={permissionIds.includes(perm.id)}
                        onChange={(e) => togglePermission(perm.id, e.target.checked)}
                        disabled={locked}
                        className="size-3.5 accent-accent"
                      />
                      {perm.action}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
