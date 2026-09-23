'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Topbar, Breadcrumb, Card, CardHeader, CardTitle, CardDescription, Button, EmptyState, ConfirmDialog, useToast } from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { UserRecord } from '../../../lib/types';
import { useSiteName } from '../site-name-context';
import { UserRow } from './user-row';
import { UserModal } from './user-modal';

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function UsersEmptyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  );
}

export default function UsersPage() {
  const siteName = useSiteName();
  const toast = useToast();
  const { data: session } = useSession();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);

  // Lightweight UX guard only — the real enforcement is server-side in
  // apps/api via the x-user-id header/permission guard.
  useEffect(() => {
    if (session && session.user.role !== 'ADMIN') {
      router.replace('/');
    }
  }, [session, router]);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<UserRecord[]>('users');
      setUsers(data);
    } catch (err) {
      toast({ type: 'error', title: 'Could not load users', message: err instanceof Error ? err.message : undefined });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await apiFetch(`users/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ type: 'info', title: 'User removed', message: deleteTarget.username });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove user', message: err instanceof Error ? err.message : undefined });
    }
  }

  if (session && session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <>
      <Topbar>
        <Breadcrumb section={siteName} page="Users" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Users</CardTitle>
              <CardDescription>Manage who can log in to the dashboard and what they can do</CardDescription>
            </div>
            <Button
              onClick={() => {
                setEditingUser(null);
                setModalOpen(true);
              }}
            >
              <PlusIcon />
              Add user
            </Button>
          </CardHeader>

          {users === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : users.length === 0 ? (
            <EmptyState icon={<UsersEmptyIcon />} title="No users yet" description="Add a user above to get started" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Name</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Username</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Role</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Active</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Created</th>
                    <th className="w-20 px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <UserRow
                      key={user.id}
                      user={user}
                      onChanged={load}
                      onEditRequested={(u) => {
                        setEditingUser(u);
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

      <UserModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        editingUser={editingUser}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove user?"
        description={`Remove "${deleteTarget?.username ?? ''}"? They will no longer be able to log in.`}
        confirmLabel="Remove"
      />
    </>
  );
}
