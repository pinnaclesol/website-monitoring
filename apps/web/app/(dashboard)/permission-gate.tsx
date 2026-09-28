'use client';

import { useSession } from 'next-auth/react';
import { hasPermission, type Permission } from '@uptime/auth';
import { Card, CardHeader, CardTitle, CardDescription, EmptyState } from '@uptime/ui';

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

/**
 * Wraps a page's content, showing it only once the session has loaded AND
 * confirms the required permission — otherwise a plain "Access restricted"
 * card instead of leaving the page's own `data === null` check spinning on
 * "Loading…" forever (that check waits for a fetch that a 403 will never
 * resolve into data). `DashboardNav` already hides the matching sidebar
 * link for a permission a user lacks (see `nav-items.tsx`), so this is
 * reached only via a stale link, browser back/forward, or a typed URL —
 * still worth a clear message rather than a silent dead end.
 *
 * Renders nothing while the session itself is still loading (`status ===
 * 'loading'`) — a brief blank beat, same as every other permission check
 * in this app that depends on `useSession()`.
 */
export function PermissionGate({ permission, children }: { permission: Permission; children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return null;
  }

  if (!session || !hasPermission(session.user.permissions, permission)) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access restricted</CardTitle>
            <CardDescription>You don&rsquo;t have permission to view this page.</CardDescription>
          </CardHeader>
          <EmptyState
            icon={<LockIcon />}
            title="Missing permission"
            description={`This page requires the "${permission}" permission — ask an admin to grant it if you need access.`}
          />
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
