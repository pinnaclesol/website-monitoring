'use client';

import { useEffect, useState } from 'react';
import {
  Topbar,
  Breadcrumb,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Button,
  Toggle,
  Badge,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { BrandingSettings } from '../../../lib/branding-settings';
import type { TelegramAccount, SignalConfig, EmailRecipient, AlertSettings } from '../../../lib/types';
import { useSiteName } from '../site-name-context';

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-text-subtle">{children}</div>
  );
}
function Separator() {
  return <div className="my-5 h-px bg-border" />;
}
function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-medium text-text">{children}</label>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-text-muted">{children}</div>;
}

export default function NotificationsPage() {
  const toast = useToast();
  const breadcrumbSiteName = useSiteName();

  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [savingGeneral, setSavingGeneral] = useState(false);

  const [telegramAccounts, setTelegramAccounts] = useState<TelegramAccount[] | null>(null);
  const [newTgLabel, setNewTgLabel] = useState('');
  const [newTgToken, setNewTgToken] = useState('');
  const [newTgChat, setNewTgChat] = useState('');
  const [addingTg, setAddingTg] = useState(false);

  const [signal, setSignal] = useState<SignalConfig | null>(null);
  const [signalSender, setSignalSender] = useState('');
  const [signalRecipient, setSignalRecipient] = useState('');
  const [savingSignal, setSavingSignal] = useState(false);

  const [emailRecipients, setEmailRecipients] = useState<EmailRecipient[] | null>(null);
  const [newEmail, setNewEmail] = useState('');
  const [addingEmail, setAddingEmail] = useState(false);

  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [interval_, setInterval_] = useState(300);
  const [recoveryAlert, setRecoveryAlert] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function load() {
      const [app, tg, sig, email, ns] = await Promise.all([
        apiFetch<BrandingSettings>('settings/branding'),
        apiFetch<TelegramAccount[]>('settings/telegram-accounts'),
        apiFetch<SignalConfig | null>('settings/signal-config'),
        apiFetch<EmailRecipient[]>('settings/email-recipients'),
        apiFetch<AlertSettings>('settings/alerts'),
      ]);
      setBrandingSettings(app);
      setSiteName(app.siteName);
      setFaviconUrl(app.faviconUrl ?? '');
      setTelegramAccounts(tg);
      setSignal(sig);
      if (sig) {
        setSignalSender(sig.senderNumber);
        setSignalRecipient(sig.recipientNumber);
      }
      setEmailRecipients(email);
      setSettings(ns);
      setInterval_(ns.alertIntervalSeconds);
      setRecoveryAlert(ns.recoveryAlertEnabled);
    }
    load().catch((err) => toast({ type: 'error', title: 'Could not load settings', message: err.message }));
    // Load once — this page has no live-updating data, unlike the dashboard/incidents polls.
  }, []);

  async function saveGeneral() {
    setSavingGeneral(true);
    try {
      const updated = await apiFetch<BrandingSettings>('settings/branding', {
        method: 'PATCH',
        body: JSON.stringify({ siteName: siteName.trim() || 'Uptime Monitor', faviconUrl: faviconUrl.trim() }),
      });
      setBrandingSettings(updated);
      toast({ type: 'success', title: 'Settings saved', message: 'Reload the page to see the new name/icon everywhere' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingGeneral(false);
    }
  }

  async function addTelegramAccount() {
    if (!newTgLabel.trim() || !newTgToken.trim() || !newTgChat.trim()) {
      toast({ type: 'error', title: 'All fields required', message: 'Label, bot token, and chat ID are all needed.' });
      return;
    }
    setAddingTg(true);
    try {
      const created = await apiFetch<TelegramAccount>('settings/telegram-accounts', {
        method: 'POST',
        body: JSON.stringify({ label: newTgLabel.trim(), botToken: newTgToken.trim(), chatId: newTgChat.trim() }),
      });
      setTelegramAccounts((prev) => [...(prev ?? []), created]);
      setNewTgLabel('');
      setNewTgToken('');
      setNewTgChat('');
      toast({ type: 'success', title: 'Telegram account added', message: created.label });
    } catch (err) {
      toast({ type: 'error', title: 'Could not add account', message: err instanceof Error ? err.message : undefined });
    } finally {
      setAddingTg(false);
    }
  }

  async function removeTelegramAccount(id: string, label: string) {
    try {
      await apiFetch(`settings/telegram-accounts/${id}`, { method: 'DELETE' });
      setTelegramAccounts((prev) => (prev ?? []).filter((a) => a.id !== id));
      toast({ type: 'info', title: 'Removed', message: label });
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove account', message: err instanceof Error ? err.message : undefined });
    }
  }

  async function saveSignal() {
    if (!signalSender.trim() || !signalRecipient.trim()) {
      toast({ type: 'error', title: 'Both numbers required' });
      return;
    }
    setSavingSignal(true);
    try {
      const updated = await apiFetch<SignalConfig>('settings/signal-config', {
        method: 'PUT',
        body: JSON.stringify({ senderNumber: signalSender.trim(), recipientNumber: signalRecipient.trim() }),
      });
      setSignal(updated);
      toast({ type: 'success', title: 'Signal settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save Signal settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSignal(false);
    }
  }

  async function addEmailRecipient() {
    if (!newEmail.trim()) {
      toast({ type: 'error', title: 'Email required' });
      return;
    }
    setAddingEmail(true);
    try {
      const created = await apiFetch<EmailRecipient>('settings/email-recipients', {
        method: 'POST',
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      setEmailRecipients((prev) => [...(prev ?? []), created]);
      setNewEmail('');
      toast({ type: 'success', title: 'Email recipient added', message: created.email });
    } catch (err) {
      toast({ type: 'error', title: 'Could not add recipient', message: err instanceof Error ? err.message : undefined });
    } finally {
      setAddingEmail(false);
    }
  }

  async function removeEmailRecipient(id: string, email: string) {
    try {
      await apiFetch(`settings/email-recipients/${id}`, { method: 'DELETE' });
      setEmailRecipients((prev) => (prev ?? []).filter((r) => r.id !== id));
      toast({ type: 'info', title: 'Removed', message: email });
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove recipient', message: err instanceof Error ? err.message : undefined });
    }
  }

  async function saveAlertBehavior() {
    setSavingSettings(true);
    try {
      const updated = await apiFetch<AlertSettings>('settings/alerts', {
        method: 'PATCH',
        body: JSON.stringify({ alertIntervalSeconds: interval_, recoveryAlertEnabled: recoveryAlert }),
      });
      setSettings(updated);
      toast({ type: 'success', title: 'Settings saved', message: 'Alert behavior updated' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSettings(false);
    }
  }

  const loading =
    brandingSettings === null || telegramAccounts === null || emailRecipients === null || settings === null;

  return (
    <>
      <Topbar>
        <Breadcrumb section={breadcrumbSiteName} page="Settings" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card className="max-w-[560px]">
          <CardHeader>
            <CardTitle>Settings</CardTitle>
            <CardDescription>Dashboard branding and where alerts go when a site goes down</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="px-6 pb-6 text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="px-5 pb-5">
              {/* General — dashboard branding (name shown in the sidebar/browser tab, favicon) */}
              <SectionLabel>General</SectionLabel>
              <div className="mb-3.5">
                <FieldLabel>Site name</FieldLabel>
                <Input value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="Uptime Monitor" />
                <Hint>Shown in the sidebar and the browser tab title</Hint>
              </div>
              <div className="mb-3.5">
                <FieldLabel>
                  Favicon / logo URL <span className="font-normal text-text-subtle">(optional)</span>
                </FieldLabel>
                <Input
                  value={faviconUrl}
                  onChange={(e) => setFaviconUrl(e.target.value)}
                  placeholder="https://example.com/icon.png"
                />
                <Hint>Used as both the sidebar logo mark and the browser tab icon</Hint>
              </div>
              <Button size="sm" onClick={saveGeneral} disabled={savingGeneral}>
                {savingGeneral ? 'Saving…' : 'Save general settings'}
              </Button>

              <Separator />

              {/* Telegram — multiple destinations, per CLAUDE.md's TelegramAccount model */}
              <SectionLabel>Telegram</SectionLabel>
              <div className="mb-3 flex flex-col gap-2">
                {telegramAccounts!.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-bg-secondary px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-text">{account.label}</div>
                      <div className="truncate font-mono text-xs text-text-muted">chat {account.chatId}</div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge status={account.isActive ? 'up' : 'paused'} label={account.isActive ? 'Active' : 'Inactive'} />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTelegramAccount(account.id, account.label)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
                {telegramAccounts!.length === 0 ? (
                  <div className="text-[13px] text-text-muted">No Telegram destinations yet.</div>
                ) : null}
              </div>
              <div className="rounded border border-dashed border-border-strong p-3">
                <div className="mb-2 grid gap-2 sm:grid-cols-3">
                  <Input
                    value={newTgLabel}
                    onChange={(e) => setNewTgLabel(e.target.value)}
                    placeholder="Label (e.g. Ops team)"
                  />
                  <Input
                    value={newTgToken}
                    onChange={(e) => setNewTgToken(e.target.value)}
                    placeholder="Bot token"
                    type="password"
                  />
                  <Input value={newTgChat} onChange={(e) => setNewTgChat(e.target.value)} placeholder="Chat ID" />
                </div>
                <Hint>Get a bot token from @BotFather on Telegram</Hint>
                <Button size="sm" className="mt-2" onClick={addTelegramAccount} disabled={addingTg}>
                  {addingTg ? 'Adding…' : 'Add Telegram destination'}
                </Button>
              </div>

              <Separator />

              {/* Signal — single config, requires the signal-cli-rest-api sidecar */}
              <SectionLabel>Signal</SectionLabel>
              <div className="mb-3.5">
                <FieldLabel>Sender phone number</FieldLabel>
                <Input value={signalSender} onChange={(e) => setSignalSender(e.target.value)} placeholder="+15550000000" />
                <Hint>The number registered with signal-cli-rest-api</Hint>
              </div>
              <div className="mb-3.5">
                <FieldLabel>Recipient number</FieldLabel>
                <Input
                  value={signalRecipient}
                  onChange={(e) => setSignalRecipient(e.target.value)}
                  placeholder="+15551111111"
                />
                <Hint>Who receives the alert messages</Hint>
              </div>
              <Button size="sm" onClick={saveSignal} disabled={savingSignal}>
                {savingSignal ? 'Saving…' : signal ? 'Update Signal settings' : 'Save Signal settings'}
              </Button>

              <Separator />

              {/* Email — multiple recipients, sent via one env-configured SMTP relay */}
              <SectionLabel>Email</SectionLabel>
              <div className="mb-3 flex flex-col gap-2">
                {emailRecipients!.map((recipient) => (
                  <div
                    key={recipient.id}
                    className="flex items-center justify-between gap-2 rounded border border-border bg-bg-secondary px-3 py-2"
                  >
                    <span className="truncate text-[13px] text-text">{recipient.email}</span>
                    <Button variant="ghost" size="sm" onClick={() => removeEmailRecipient(recipient.id, recipient.email)}>
                      Remove
                    </Button>
                  </div>
                ))}
                {emailRecipients!.length === 0 ? (
                  <div className="text-[13px] text-text-muted">No email recipients yet.</div>
                ) : null}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="ops@yourcompany.com"
                  type="email"
                  className="flex-1"
                />
                <Button onClick={addEmailRecipient} disabled={addingEmail}>
                  {addingEmail ? 'Adding…' : 'Add'}
                </Button>
              </div>

              <Separator />

              <SectionLabel>Alert behaviour</SectionLabel>
              <div className="mb-3.5">
                <FieldLabel>Repeat alert every</FieldLabel>
                <div className="flex w-fit items-stretch">
                  <Input
                    type="number"
                    min={30}
                    step={30}
                    value={interval_}
                    onChange={(e) => setInterval_(Number(e.target.value))}
                    className="w-[100px] rounded-r-none border-r-0"
                  />
                  <span className="flex items-center rounded rounded-l-none border border-border-strong bg-bg-muted px-3 text-[13px] text-text-muted">
                    seconds
                  </span>
                </div>
                <Hint>How often to re-send while a site is still down.</Hint>
              </div>
              <div className="mb-4">
                <FieldLabel>Send recovery alert</FieldLabel>
                <div className="mt-1.5 flex items-center gap-2.5">
                  <Toggle checked={recoveryAlert} onCheckedChange={setRecoveryAlert} />
                  <span className="text-[13px] text-text-muted">Notify when a downed site comes back online</span>
                </div>
              </div>
              <Button onClick={saveAlertBehavior} disabled={savingSettings}>
                {savingSettings ? 'Saving…' : 'Save settings'}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
