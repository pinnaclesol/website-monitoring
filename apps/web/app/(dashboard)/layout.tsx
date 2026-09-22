import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { DashboardNav } from './dashboard-nav';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-bg">
      <DashboardNav username={session.user.username} />
      <div className="ml-[248px] flex min-h-screen flex-col">{children}</div>
    </div>
  );
}
