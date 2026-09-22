'use client';

import { Button } from '@uptime/ui';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => signOut({ callbackUrl: '/login' })}>
      Sign out
    </Button>
  );
}
