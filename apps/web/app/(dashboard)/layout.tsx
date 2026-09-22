import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { SignOutButton } from './sign-out-button';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="flex items-center justify-between border-b border-border bg-bg-secondary px-6 py-4">
        <span className="text-sm text-text">
          Signed in as <span className="font-semibold">{session.user.username}</span>
        </span>
        <SignOutButton />
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
