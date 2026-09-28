'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Topbar, Breadcrumb, Card, CardHeader, CardTitle, CardDescription, Button, EmptyState, ConfirmDialog, useToast } from '@uptime/ui';
import { hasPermission } from '@uptime/auth';
import { apiFetch } from '../../../lib/api-client';
import type { RoleRecord } from '../../../lib/types';
import { useSiteName } from '../site-name-context';
import { PermissionGate } from '../permission-gate';
import { RoleRow } from './role-row';
import { RoleModal } from './role-modal';

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function RolesEmptyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export default function RolesPage() {
  const siteName = useSiteName();
  const toast = useToast();
  const { data: session } = useSession();
  const permissions = session?.user.permissions;
  const canCreate = !!permissions && hasPermission(permissions, 'roles:create');
  const canUpdate = !!permissions && hasPermission(permissions, 'roles:update');
  const canDelete = !!permissions && hasPermission(permissions, 'roles:delete');

  const [roles, setRoles] = useState<RoleRecord[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RoleRecord | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<RoleRecord[]>('roles');
      setRoles(data);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load roles', message: err instanceof Error ? err.message : undefined });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`roles/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ type: 'info', title: 'Role removed', message: deleteTarget.name });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove role', message: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <PermissionGate permission="roles:view">
      <Topbar>
        <Breadcrumb section={siteName} page="Roles" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Roles</CardTitle>
              <CardDescription>Define named permission sets and assign them to users</CardDescription>
            </div>
            {canCreate ? (
              <Button
                onClick={() => {
                  setEditingRole(null);
                  setModalOpen(true);
                }}
              >
                <PlusIcon />
                Add role
              </Button>
            ) : null}
          </CardHeader>

          {roles === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : roles.length === 0 ? (
            <EmptyState icon={<RolesEmptyIcon />} title="No roles yet" description="Add a role above to get started" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Name</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Description</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Permissions</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Users</th>
                    <th className="w-20 px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <RoleRow
                      key={role.id}
                      role={role}
                      canUpdate={canUpdate}
                      canDelete={canDelete}
                      onEditRequested={(r) => {
                        setEditingRole(r);
                        setModalOpen(true);
                      }}
                      onDeleteRequested={setDeleteTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <RoleModal open={modalOpen} onClose={() => setModalOpen(false)} onSaved={load} editingRole={editingRole} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove role?"
        description={`Remove "${deleteTarget?.name ?? ''}"? This can't be undone.`}
        confirmLabel="Remove"
      />
    </PermissionGate>
  );
}
