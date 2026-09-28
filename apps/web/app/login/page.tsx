'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, getSession } from 'next-auth/react';
import { hasPermission } from '@uptime/auth';
import { LoginForm } from '@uptime/ui';
import { NAV_ITEMS } from '../(dashboard)/nav-items';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleSubmit(username: string, password: string) {
    setError(undefined);

    const result = await signIn('credentials', {
      username,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      setError('Invalid username or password.');
      return;
    }

    // Land on the first page (in sidebar priority order) this user's role(s)
    // actually grant — not a hardcoded "/", which 403s forever for a role
    // scoped to e.g. only Incidents. signIn() above doesn't hand back the
    // session itself, so re-fetch it once to read the fresh permissions.
    const session = await getSession();
    const firstAllowed = NAV_ITEMS.find((item) => hasPermission(session?.user.permissions ?? [], item.permission));
    router.push(firstAllowed?.href ?? '/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4">
      <LoginForm onSubmit={handleSubmit} error={error} />
    </main>
  );
}
