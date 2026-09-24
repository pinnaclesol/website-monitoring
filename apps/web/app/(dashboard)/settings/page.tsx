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
  SidebarHeader,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { BrandingSettings } from '../../../lib/branding-settings';
import type { MonitoringSettings } from '../../../lib/types';
import { useSiteName, useBranding } from '../site-name-context';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-medium text-text">{children}</label>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-text-muted">{children}</div>;
}
function PreviewLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-text-subtle">{children}</div>;
}

function DefaultTabGlyph() {
  return (
    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

/** A small, recognizable mock of a browser tab — so a Site-title/favicon change is visible before it's saved. */
function BrowserTabPreview({ title, faviconUrl }: { title: string; faviconUrl: string | null }) {
  return (
    <div className="w-[220px] overflow-hidden rounded-lg border border-border shadow-sm">
      <div className="bg-bg-muted px-2 pt-2">
        <div className="flex max-w-[180px] items-center gap-1.5 rounded-t-md border border-b-0 border-border bg-bg px-2.5 py-1.5">
          {faviconUrl ? (
            <img src={faviconUrl} alt="" className="size-3.5 shrink-0 rounded-sm object-contain" />
          ) : (
            <span className="flex size-3.5 shrink-0 items-center justify-center rounded-sm bg-accent text-accent-fg">
              <DefaultTabGlyph />
            </span>
          )}
          <span className="truncate text-[11px] text-text">{title}</span>
        </div>
      </div>
      <div className="border-t border-border bg-bg px-2.5 py-2 text-[10px] text-text-subtle">yourdomain.com</div>
    </div>
  );
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

const CHECK_INTERVAL_MIN = 30;
const CHECK_INTERVAL_MAX = 3600;

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
  const [savingSite, setSavingSite] = useState(false);
  const [savingApplication, setSavingApplication] = useState(false);

  const [monitoringSettings, setMonitoringSettings] = useState<MonitoringSettings | null>(null);
  const [checkInterval, setCheckInterval] = useState(60);
  const [savingMonitoring, setSavingMonitoring] = useState(false);

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

    apiFetch<MonitoringSettings>('settings/monitoring')
      .then((settings) => {
        setMonitoringSettings(settings);
        setCheckInterval(settings.checkIntervalSeconds);
      })
      .catch((err) => toast({ type: 'error', title: 'Could not load monitoring settings', message: err.message }));
  }, []);

  async function saveSite() {
    setSavingSite(true);
    try {
      const trimmedSiteTitle = siteTitle.trim() || 'Uptime Monitor';
      const updated = await apiFetch<BrandingSettings>('settings/branding', {
        method: 'PATCH',
        body: JSON.stringify({ siteTitle: trimmedSiteTitle, faviconUrl: faviconUrl ?? '' }),
      });
      setBrandingSettings(updated);
      setSiteTitle(updated.siteTitle);

      // Instant, reload-free feedback for the browser tab — it lives in the
      // root layout's server-rendered <head>, outside the client tree this
      // page runs in, so it's patched imperatively.
      applyBrowserTabBranding(updated.siteTitle, updated.faviconUrl);
      router.refresh();

      toast({ type: 'success', title: 'Site settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save site settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSite(false);
    }
  }

  async function saveApplication() {
    setSavingApplication(true);
    try {
      const trimmedAppName = appName.trim() || 'Uptime Monitor';
      const updated = await apiFetch<BrandingSettings>('settings/branding', {
        method: 'PATCH',
        body: JSON.stringify({ appName: trimmedAppName, appLogoUrl: appLogoUrl ?? '' }),
      });
      setBrandingSettings(updated);
      setAppName(updated.appName);

      // Instant, reload-free sidebar update via the shared branding context.
      setBranding({ appName: updated.appName, appLogoUrl: updated.appLogoUrl });
      router.refresh();

      toast({ type: 'success', title: 'Application settings saved' });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not save application settings',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingApplication(false);
    }
  }

  async function saveMonitoring() {
    if (!intervalValid) return;
    setSavingMonitoring(true);
    try {
      const updated = await apiFetch<MonitoringSettings>('settings/monitoring', {
        method: 'PATCH',
        body: JSON.stringify({ checkIntervalSeconds: checkInterval }),
      });
      setMonitoringSettings(updated);
      setCheckInterval(updated.checkIntervalSeconds);
      toast({
        type: 'success',
        title: 'Monitoring settings saved',
        message: `Now checking every ${updated.checkIntervalSeconds}s`,
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not save monitoring settings',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingMonitoring(false);
    }
  }

  const loading = brandingSettings === null || monitoringSettings === null;

  const intervalIsInteger = Number.isInteger(checkInterval);
  const intervalError = !intervalIsInteger
    ? 'Must be a whole number of seconds'
    : checkInterval < CHECK_INTERVAL_MIN
      ? `Must be at least ${CHECK_INTERVAL_MIN} seconds`
      : checkInterval > CHECK_INTERVAL_MAX
        ? `Must be ${CHECK_INTERVAL_MAX} seconds (1 hour) or less`
        : null;
  const intervalValid = intervalError === null;

  return (
    <>
      <Topbar>
        <Breadcrumb section={breadcrumbSiteName} page="Settings" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card className="max-w-[640px]">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Branding and monitoring behavior</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="px-6 pb-6 text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="px-5 pb-5">
              <Tabs defaultValue="site">
                <TabsList>
                  <TabsTrigger value="site">Site</TabsTrigger>
                  <TabsTrigger value="application">Application</TabsTrigger>
                  <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
                </TabsList>

                <TabsContent value="site">
                  <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
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
                    <div>
                      <PreviewLabel>Preview</PreviewLabel>
                      <BrowserTabPreview title={siteTitle.trim() || 'Uptime Monitor'} faviconUrl={faviconUrl} />
                    </div>
                  </div>
                  {canUpdate ? (
                    <Button className="mt-5" onClick={saveSite} disabled={savingSite}>
                      {savingSite ? 'Saving…' : 'Save site settings'}
                    </Button>
                  ) : null}
                </TabsContent>

                <TabsContent value="application">
                  <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-4">
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
                    <div>
                      <PreviewLabel>Preview</PreviewLabel>
                      <div className="w-[200px] overflow-hidden rounded-lg border border-border shadow-sm">
                        <SidebarHeader
                          productName={appName.trim() || 'Uptime Monitor'}
                          icon={appLogoUrl ? <img src={appLogoUrl} alt="" /> : undefined}
                          className="border-b-0 pb-4"
                        />
                      </div>
                    </div>
                  </div>
                  {canUpdate ? (
                    <Button className="mt-5" onClick={saveApplication} disabled={savingApplication}>
                      {savingApplication ? 'Saving…' : 'Save application settings'}
                    </Button>
                  ) : null}
                </TabsContent>

                <TabsContent value="monitoring">
                  <div className="mb-4">
                    <FieldLabel>Check interval</FieldLabel>
                    <div className="flex w-fit items-stretch">
                      <Input
                        type="number"
                        min={CHECK_INTERVAL_MIN}
                        max={CHECK_INTERVAL_MAX}
                        step={30}
                        value={checkInterval}
                        onChange={(e) => setCheckInterval(Number(e.target.value))}
                        className={`w-[100px] rounded-r-none border-r-0 ${intervalError ? 'border-red' : ''}`}
                        disabled={!canUpdate}
                        aria-invalid={!!intervalError}
                      />
                      <span className="flex items-center rounded rounded-l-none border border-border-strong bg-bg-muted px-3 text-[13px] text-text-muted">
                        seconds
                      </span>
                    </div>
                    <div className={`mt-1 text-xs ${intervalError ? 'text-red' : 'text-text-muted'}`}>
                      {intervalError ?? 'Applies immediately to every active monitor, not just new ones'}
                    </div>
                  </div>
                  {canUpdate ? (
                    <Button onClick={saveMonitoring} disabled={savingMonitoring || !intervalValid}>
                      {savingMonitoring ? 'Saving…' : 'Save monitoring settings'}
                    </Button>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
