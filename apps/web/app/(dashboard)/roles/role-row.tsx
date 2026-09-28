'use client';

import { Button } from '@uptime/ui';
import type { RoleRecord } from '../../../lib/types';

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

export function RoleRow({
  role,
  onEditRequested,
  onDeleteRequested,
}: {
  role: RoleRecord;
  onEditRequested: (role: RoleRecord) => void;
  onDeleteRequested: (role: RoleRecord) => void;
}) {
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-secondary">
      <td className="px-5 py-2.5">
        <span className="text-[13.5px] font-medium text-text">{role.name}</span>
      </td>
      <td className="px-5 py-2.5">
        <span className="text-[13px] text-text-muted">{role.description || <span className="text-text-subtle">—</span>}</span>
      </td>
      <td className="px-5 py-2.5">
        <span className="text-[13px] text-text-muted">{role._count.permissions}</span>
      </td>
      <td className="px-5 py-2.5">
        <span className="text-[13px] text-text-muted">{role._count.users}</span>
      </td>
      <td className="px-5 py-2.5">
        {role.isSystem ? (
          <span
            className="flex items-center gap-1.5 px-1.5 text-xs text-text-subtle"
            title="The Admin role can't be renamed, have its permissions changed, or be deleted — it always has every permission"
          >
            <LockIcon />
            Protected
          </span>
        ) : (
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="sm" className="p-1.5" title="Edit role" onClick={() => onEditRequested(role)}>
              <EditIcon />
            </Button>
            <Button variant="ghost" size="sm" className="p-1.5" title="Delete role" onClick={() => onDeleteRequested(role)}>
              <TrashIcon />
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
