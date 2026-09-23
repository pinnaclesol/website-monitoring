'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { hasPermission } from '@uptime/auth';
import {
  Topbar,
  Breadcrumb,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  ImageUpload,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { BrandingSettings } from '../../../lib/branding-settings';
import { useSiteName, useBranding } from '../site-name-context';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-medium text-text">{children}</label>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-text-muted">{children}</div>;
}

/** Reflects a browser-tab field (title/favicon) instantly — these live in the root layout's server-rendered <head>, outside the client-side branding context. */
function applyBrowserTabBranding(siteTitle: string, faviconUrl: string | null) {
  document.title = siteTitle;

  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!faviconUrl) {
    link?.remove();
    return;
  }
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  link.href = faviconUrl;
}

export default function SettingsPage() {
  const breadcrumbSiteName = useSiteName();
  const { setBranding } = useBranding();
  const toast = useToast();
  const router = useRouter();
  const { data: session } = useSession();
  const canUpdate = !!session?.user.role && hasPermission(session.user.role, 'settings:update');

  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const [appName, setAppName] = useState('');
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [siteTitle, setSiteTitle] = useState('');
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<BrandingSettings>('settings/branding')
      .then((settings) => {
        setBrandingSettings(settings);
        setAppName(settings.appName);
        setAppLogoUrl(settings.appLogoUrl);
        setSiteTitle(settings.siteTitle);
        setFaviconUrl(settings.faviconUrl);
      })
      .catch((err) => toast({ type: 'error', title: 'Could not load settings', message: err.message }));
  }, []);

  async function save() {
    setSaving(true);
    try {
      const trimmedAppName = appName.trim() || 'Uptime Monitor';
      const trimmedSiteTitle = siteTitle.trim() || 'Uptime Monitor';

      const updated = await apiFetch<BrandingSettings>('settings/branding', {
        method: 'PATCH',
        body: JSON.stringify({
          appName: trimmedAppName,
          appLogoUrl: appLogoUrl ?? '',
          siteTitle: trimmedSiteTitle,
          faviconUrl: faviconUrl ?? '',
        }),
      });
      setBrandingSettings(updated);

      // Instant, reload-free feedback: the sidebar re-renders from context,
      // and the browser tab is patched imperatively (it's outside the React
      // tree this page lives in). router.refresh() is a cheap consistency
      // pass on top, not the primary mechanism.
      setBranding({ appName: updated.appName, appLogoUrl: updated.appLogoUrl });
      applyBrowserTabBranding(updated.siteTitle, updated.faviconUrl);
      router.refresh();

      toast({ type: 'success', title: 'Settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  }

  const loading = brandingSettings === null;

  return (
    <>
      <Topbar>
        <Breadcrumb section={breadcrumbSiteName} page="Settings" />
      </Topbar>
      <div className="flex-1 space-y-6 p-6">
        <Card className="max-w-[520px]">
          <CardHeader>
            <CardTitle>Site</CardTitle>
            <CardDescription>Browser-facing details — what shows in the tab title and bookmark icon</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="px-6 pb-6 text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="space-y-4 px-6 pb-6">
              <div>
                <FieldLabel>Site title</FieldLabel>
                <Input
                  value={siteTitle}
                  onChange={(e) => setSiteTitle(e.target.value)}
                  placeholder="Uptime Monitor"
                  disabled={!canUpdate}
                />
                <Hint>Shown in the browser tab</Hint>
              </div>
              <ImageUpload
                label="Favicon"
                hint="Shown as the browser tab icon"
                value={faviconUrl}
                onChange={setFaviconUrl}
                disabled={!canUpdate}
              />
            </div>
          )}
        </Card>

        <Card className="max-w-[520px]">
          <CardHeader>
            <CardTitle>Application</CardTitle>
            <CardDescription>Shown inside the dashboard itself</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="px-6 pb-6 text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="space-y-4 px-6 pb-6">
              <div>
                <FieldLabel>Application name</FieldLabel>
                <Input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="Uptime Monitor"
                  disabled={!canUpdate}
                />
                <Hint>Shown in the sidebar</Hint>
              </div>
              <ImageUpload
                label="Application logo"
                hint="Shown as the sidebar logo mark"
                value={appLogoUrl}
                onChange={setAppLogoUrl}
                disabled={!canUpdate}
              />
            </div>
          )}
        </Card>

        {!loading && canUpdate ? (
          <div className="max-w-[520px]">
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  );
}
