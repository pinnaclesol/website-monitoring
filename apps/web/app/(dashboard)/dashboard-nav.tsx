'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import type { Role } from '@uptime/auth';
import {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
  SidebarFooter,
  Button,
  ConfirmDialog,
} from '@uptime/ui';
import { ThemeToggle } from './theme-toggle';
import { useBranding } from './site-name-context';

function DashboardIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IncidentsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}
function NotificationsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/incidents', label: 'Incidents', icon: <IncidentsIcon /> },
  { href: '/notifications', label: 'Notifications', icon: <NotificationsIcon /> },
  { href: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

const ADMIN_NAV_ITEMS = [{ href: '/users', label: 'Users', icon: <UsersIcon /> }];

export function DashboardNav({
  username,
  name,
  role,
}: {
  username: string;
  name: string | null;
  role: Role;
}) {
  const pathname = usePathname();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const { appName, appLogoUrl } = useBranding();
  const displayName = name || username;
  const initial = displayName.charAt(0).toUpperCase();
  const navItems = role === 'ADMIN' ? [...NAV_ITEMS, ...ADMIN_NAV_ITEMS] : NAV_ITEMS;

  return (
    <Sidebar>
      <SidebarHeader
        productName={appName}
        // Plain <img>, not next/image: an uploaded/admin-supplied path, and
        // next/image requires allow-listing remote hosts up front.
        icon={appLogoUrl ? <img src={appLogoUrl} alt="" /> : undefined}
      />
      <SidebarNav>
        {navItems.map((item) => (
          <SidebarNavItem key={item.href} asChild active={pathname === item.href}>
            <Link href={item.href}>
              {item.icon}
              {item.label}
            </Link>
          </SidebarNavItem>
        ))}
      </SidebarNav>
      <SidebarFooter className="flex flex-col gap-1">
        <ThemeToggle />
        <div className="mt-1 flex items-center gap-2 rounded-sm px-2 py-1.5">
          <span
            aria-hidden="true"
            className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-accent-fg"
          >
            {initial}
          </span>
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-text" title={displayName}>
            {displayName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="p-1.5 text-text-muted hover:text-text"
            title="Sign out"
            aria-label="Sign out"
            onClick={() => setSignOutConfirmOpen(true)}
          >
            <SignOutIcon />
          </Button>
        </div>
      </SidebarFooter>

      <ConfirmDialog
        open={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={() => signOut({ callbackUrl: '/login' })}
        title="Sign out?"
        description="You'll need to log in again to access the dashboard."
        confirmLabel="Sign out"
      />
    </Sidebar>
  );
}
