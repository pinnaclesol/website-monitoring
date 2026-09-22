'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Sidebar,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
  SidebarFooter,
  Button,
} from '@uptime/ui';
import { ThemeToggle } from './theme-toggle';

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

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: <DashboardIcon /> },
  { href: '/incidents', label: 'Incidents', icon: <IncidentsIcon /> },
  { href: '/notifications', label: 'Notifications', icon: <NotificationsIcon /> },
];

export function DashboardNav({ username }: { username: string }) {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader />
      <SidebarNav>
        {NAV_ITEMS.map((item) => (
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
        <div className="flex items-center justify-between gap-2 px-2 pt-1.5">
          <span className="truncate text-xs text-text-muted" title={username}>
            {username}
          </span>
          <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
            Sign out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
