'use client';

import { Badge, Toggle, Button, useToast } from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { UserRecord } from '../../../lib/types';

// Badge only exposes the up/down/paused/checking status colors (see
// libs/ui/src/components/ui/Badge.tsx) — reused here for role coloring
// rather than inventing a new variant. Roles are dynamic now, so colors
// cycle through this palette by index instead of a fixed per-role map.
const ROLE_BADGE_STATUS_CYCLE = ['checking', 'paused', 'up', 'down'] as const;

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
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
function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

export function UserRow({
  user,
  canUpdate,
  canDelete,
  onChanged,
  onEditRequested,
  onDeleteRequested,
}: {
  user: UserRecord;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
  onEditRequested: (user: UserRecord) => void;
  onDeleteRequested: (user: UserRecord) => void;
}) {
  const toast = useToast();

  async function toggleActive(nextActive: boolean) {
    try {
      await apiFetch(`users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: nextActive }),
      });
      toast({ type: 'info', title: nextActive ? 'User activated' : 'User deactivated', message: user.username });
      onChanged();
    } catch (err) {
      toast({ type: 'error', title: 'Could not update user', message: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-secondary">
      <td className="px-5 py-2.5">
        <span className="text-[13.5px] font-medium text-text">{user.name || <span className="text-text-subtle">—</span>}</span>
      </td>
      <td className="px-5 py-2.5">
        <span className="text-[13px] text-text-muted">{user.username}</span>
      </td>
      <td className="px-5 py-2.5">
        <div className="flex flex-wrap gap-1">
          {user.roles.length === 0 ? (
            <span className="text-xs text-text-subtle">—</span>
          ) : (
            user.roles.map((role, i) => (
              <Badge key={role.id} status={ROLE_BADGE_STATUS_CYCLE[i % ROLE_BADGE_STATUS_CYCLE.length]} label={role.name} />
            ))
          )}
        </div>
      </td>
      <td className="px-5 py-2.5">
        <Toggle
          checked={user.active}
          onCheckedChange={toggleActive}
          disabled={user.isProtected || !canUpdate}
          aria-label={user.active ? 'Deactivate user' : 'Activate user'}
        />
      </td>
      <td className="px-5 py-2.5">
        <span className="text-xs text-text-muted">{new Date(user.createdAt).toLocaleDateString()}</span>
      </td>
      <td className="px-5 py-2.5">
        {user.isProtected ? (
          <span
            className="flex items-center gap-1.5 px-1.5 text-xs text-text-subtle"
            title="The default admin account can't be edited or deleted — its credentials are managed via `npm run uptime:seed` instead"
          >
            <LockIcon />
            Protected
          </span>
        ) : canUpdate || canDelete ? (
          <div className="flex items-center gap-0.5">
            {canUpdate ? (
              <Button variant="ghost" size="sm" className="p-1.5" title="Edit user" onClick={() => onEditRequested(user)}>
                <EditIcon />
              </Button>
            ) : null}
            {canDelete ? (
              <Button variant="ghost" size="sm" className="p-1.5" title="Delete user" onClick={() => onDeleteRequested(user)}>
                <TrashIcon />
              </Button>
            ) : null}
          </div>
        ) : null}
      </td>
    </tr>
  );
}
