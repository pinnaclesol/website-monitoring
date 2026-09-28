'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { hasPermission } from '@uptime/auth';
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
import { NAV_ITEMS } from './nav-items';

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function DashboardNav({
  username,
  name,
  permissions,
}: {
  username: string;
  name: string | null;
  permissions: string[];
}) {
  const pathname = usePathname();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const { appName, appLogoUrl } = useBranding();
  const displayName = name || username;
  const initial = displayName.charAt(0).toUpperCase();
  // Only ever shows a link to a page the user can actually open — a page
  // its permission excludes never even appears as a dead end to click into.
  const navItems = NAV_ITEMS.filter((item) => hasPermission(permissions, item.permission));

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
