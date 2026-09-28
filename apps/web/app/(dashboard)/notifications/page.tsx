'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
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
  Toggle,
  Badge,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { TelegramAccount, SignalConfig, EmailRecipient, SmtpConfig, AlertSettings } from '../../../lib/types';
import { useSiteName } from '../site-name-context';
import { PermissionGate } from '../permission-gate';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1.5 block text-[13px] font-medium text-text">{children}</label>;
}
function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-text-muted">{children}</div>;
}
function SubHeading({ children }: { children: React.ReactNode }) {
  return <div className="mb-3 text-[11.5px] font-semibold uppercase tracking-wider text-text-subtle">{children}</div>;
}

// Email sending isn't implemented yet — apps/worker's AlertsService still
// only stubs it (Telegram/Signal are real). Hidden rather than removed: the
// SmtpConfig/EmailRecipient backend, DB rows, and all the UI/handlers below
// are untouched, so flipping this back to `true` is the entire re-enable
// step once real SMTP sending exists.
const EMAIL_ENABLED = false;

export default function NotificationsPage() {
  const toast = useToast();
  const breadcrumbSiteName = useSiteName();
  const { data: session } = useSession();
  const canUpdate = !!session?.user.permissions && hasPermission(session.user.permissions, 'notifications:update');

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

  const [smtp, setSmtp] = useState<SmtpConfig | null>(null);
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpUsername, setSmtpUsername] = useState('');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpActive, setSmtpActive] = useState(true);
  const [savingSmtp, setSavingSmtp] = useState(false);

  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [recoveryAlert, setRecoveryAlert] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function load() {
      const [tg, sig, ns] = await Promise.all([
        apiFetch<TelegramAccount[]>('settings/telegram-accounts'),
        apiFetch<SignalConfig | null>('settings/signal-config'),
        apiFetch<AlertSettings>('settings/alerts'),
      ]);
      setTelegramAccounts(tg);
      setSignal(sig);
      if (sig) {
        setSignalSender(sig.senderNumber);
        setSignalRecipient(sig.recipientNumber);
      }
      setSettings(ns);
      setRecoveryAlert(ns.recoveryAlertEnabled);

      if (EMAIL_ENABLED) {
        const [email, smtpConfig] = await Promise.all([
          apiFetch<EmailRecipient[]>('settings/email-recipients'),
          apiFetch<SmtpConfig | null>('settings/smtp-config'),
        ]);
        setEmailRecipients(email);
        setSmtp(smtpConfig);
        if (smtpConfig) {
          setSmtpHost(smtpConfig.host);
          setSmtpPort(smtpConfig.port);
          setSmtpUsername(smtpConfig.username ?? '');
          setSmtpFrom(smtpConfig.fromEmail);
          setSmtpActive(smtpConfig.isActive);
        }
      }
    }
    load().catch((err) => toast({ type: 'error', title: 'Could not load settings', message: err.message }));
    // Load once — this page has no live-updating data, unlike the dashboard/incidents polls.
  }, []);

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

  async function saveSmtp() {
    if (!smtpHost.trim() || !smtpFrom.trim()) {
      toast({ type: 'error', title: 'Host and from address are required' });
      return;
    }
    setSavingSmtp(true);
    try {
      const updated = await apiFetch<SmtpConfig>('settings/smtp-config', {
        method: 'PUT',
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: smtpPort,
          username: smtpUsername.trim() || undefined,
          password: smtpPassword.trim() || undefined,
          fromEmail: smtpFrom.trim(),
          isActive: smtpActive,
        }),
      });
      setSmtp(updated);
      setSmtpPassword('');
      toast({ type: 'success', title: 'SMTP settings saved' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save SMTP settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSmtp(false);
    }
  }

  async function saveAlertBehavior() {
    setSavingSettings(true);
    try {
      const updated = await apiFetch<AlertSettings>('settings/alerts', {
        method: 'PATCH',
        body: JSON.stringify({ recoveryAlertEnabled: recoveryAlert }),
      });
      setSettings(updated);
      toast({ type: 'success', title: 'Settings saved', message: 'Alert behavior updated' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSettings(false);
    }
  }

  const loading = telegramAccounts === null || settings === null || (EMAIL_ENABLED && emailRecipients === null);

  return (
    <PermissionGate permission="notifications:view">
      <Topbar>
        <Breadcrumb section={breadcrumbSiteName} page="Notifications" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card className="max-w-[560px]">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Where alerts go when a monitor goes down</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="px-6 pb-6 text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="px-5 pb-5">
              <Tabs defaultValue="telegram">
                <TabsList>
                  <TabsTrigger value="telegram">Telegram</TabsTrigger>
                  <TabsTrigger value="signal">Signal</TabsTrigger>
                  {EMAIL_ENABLED ? <TabsTrigger value="email">Email</TabsTrigger> : null}
                  <TabsTrigger value="behaviour">Alert behaviour</TabsTrigger>
                </TabsList>

                <TabsContent value="telegram">
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
                          {canUpdate ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeTelegramAccount(account.id, account.label)}
                            >
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {telegramAccounts!.length === 0 ? (
                      <div className="text-[13px] text-text-muted">No Telegram destinations yet.</div>
                    ) : null}
                  </div>
                  {canUpdate ? (
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
                  ) : null}
                </TabsContent>

                <TabsContent value="signal">
                  <div className="mb-3.5">
                    <FieldLabel>Sender phone number</FieldLabel>
                    <Input
                      value={signalSender}
                      onChange={(e) => setSignalSender(e.target.value)}
                      placeholder="+15550000000"
                      disabled={!canUpdate}
                    />
                    <Hint>The number registered with signal-cli-rest-api</Hint>
                  </div>
                  <div className="mb-3.5">
                    <FieldLabel>Recipient number</FieldLabel>
                    <Input
                      value={signalRecipient}
                      onChange={(e) => setSignalRecipient(e.target.value)}
                      placeholder="+15551111111"
                      disabled={!canUpdate}
                    />
                    <Hint>Who receives the alert messages</Hint>
                  </div>
                  {canUpdate ? (
                    <Button size="sm" onClick={saveSignal} disabled={savingSignal}>
                      {savingSignal ? 'Saving…' : signal ? 'Update Signal settings' : 'Save Signal settings'}
                    </Button>
                  ) : null}
                </TabsContent>

                {/* Radix's TabsContent mounts its children regardless of which tab is active (only toggles visibility), so this must be skipped
                    entirely while disabled — not just left without a trigger — or emailRecipients/smtp being null (never fetched) crashes the
                    .map() calls below. Left in place, not deleted, so flipping EMAIL_ENABLED back to true is the whole re-enable step. */}
                {EMAIL_ENABLED ? (
                <TabsContent value="email">
                  <SubHeading>SMTP relay</SubHeading>
                  <div className="mb-3.5 grid gap-3 sm:grid-cols-2">
                    <div>
                      <FieldLabel>Host</FieldLabel>
                      <Input
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.yourprovider.com"
                        disabled={!canUpdate}
                      />
                    </div>
                    <div>
                      <FieldLabel>Port</FieldLabel>
                      <Input
                        type="number"
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                        placeholder="587"
                        disabled={!canUpdate}
                      />
                    </div>
                    <div>
                      <FieldLabel>
                        Username <span className="font-normal text-text-subtle">(optional)</span>
                      </FieldLabel>
                      <Input
                        value={smtpUsername}
                        onChange={(e) => setSmtpUsername(e.target.value)}
                        placeholder="smtp-user"
                        disabled={!canUpdate}
                      />
                    </div>
                    <div>
                      <FieldLabel>
                        Password{' '}
                        <span className="font-normal text-text-subtle">{smtp?.hasPassword ? '(unchanged if blank)' : '(optional)'}</span>
                      </FieldLabel>
                      <Input
                        type="password"
                        value={smtpPassword}
                        onChange={(e) => setSmtpPassword(e.target.value)}
                        placeholder={smtp?.hasPassword ? 'Leave blank to keep current password' : ''}
                        disabled={!canUpdate}
                      />
                    </div>
                  </div>
                  <div className="mb-3.5">
                    <FieldLabel>From address</FieldLabel>
                    <Input
                      type="email"
                      value={smtpFrom}
                      onChange={(e) => setSmtpFrom(e.target.value)}
                      placeholder="alerts@yourdomain.com"
                      disabled={!canUpdate}
                    />
                  </div>
                  <div className="mb-4">
                    <FieldLabel>Active</FieldLabel>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <Toggle checked={smtpActive} onCheckedChange={setSmtpActive} disabled={!canUpdate} />
                      <span className="text-[13px] text-text-muted">Send email alerts through this relay</span>
                    </div>
                  </div>
                  {canUpdate ? (
                    <Button size="sm" onClick={saveSmtp} disabled={savingSmtp}>
                      {savingSmtp ? 'Saving…' : smtp ? 'Update SMTP settings' : 'Save SMTP settings'}
                    </Button>
                  ) : null}

                  <div className="my-5 h-px bg-border" />

                  <SubHeading>Recipients</SubHeading>
                  <div className="mb-3 flex flex-col gap-2">
                    {emailRecipients!.map((recipient) => (
                      <div
                        key={recipient.id}
                        className="flex items-center justify-between gap-2 rounded border border-border bg-bg-secondary px-3 py-2"
                      >
                        <span className="truncate text-[13px] text-text">{recipient.email}</span>
                        {canUpdate ? (
                          <Button variant="ghost" size="sm" onClick={() => removeEmailRecipient(recipient.id, recipient.email)}>
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {emailRecipients!.length === 0 ? (
                      <div className="text-[13px] text-text-muted">No email recipients yet.</div>
                    ) : null}
                  </div>
                  {canUpdate ? (
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
                  ) : null}
                </TabsContent>
                ) : null}

                <TabsContent value="behaviour">
                  <Hint>
                    Exactly one alert is sent when a monitor goes down, and (if enabled below) one more when it
                    recovers — never a repeating reminder while it stays down.
                  </Hint>
                  <div className="mb-4 mt-3.5">
                    <FieldLabel>Send recovery alert</FieldLabel>
                    <div className="mt-1.5 flex items-center gap-2.5">
                      <Toggle checked={recoveryAlert} onCheckedChange={setRecoveryAlert} disabled={!canUpdate} />
                      <span className="text-[13px] text-text-muted">Notify when a downed monitor comes back online</span>
                    </div>
                  </div>
                  {canUpdate ? (
                    <Button onClick={saveAlertBehavior} disabled={savingSettings}>
                      {savingSettings ? 'Saving…' : 'Save settings'}
                    </Button>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </Card>
      </div>
    </PermissionGate>
  );
}
