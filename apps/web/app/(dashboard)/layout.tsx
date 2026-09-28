import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { getBrandingSettings } from '../../lib/branding-settings';
import { DashboardNav } from './dashboard-nav';
import { SiteNameProvider } from './site-name-context';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const [session, { appName, appLogoUrl }] = await Promise.all([
    getServerSession(authOptions),
    getBrandingSettings(),
  ]);

  if (!session) {
    redirect('/login');
  }

  return (
    <SiteNameProvider appName={appName} appLogoUrl={appLogoUrl}>
      <div className="min-h-screen bg-bg">
        <DashboardNav username={session.user.username} name={session.user.name} permissions={session.user.permissions} />
        <div className="ml-[248px] flex min-h-screen flex-col">{children}</div>
      </div>
    </SiteNameProvider>
  );
}
