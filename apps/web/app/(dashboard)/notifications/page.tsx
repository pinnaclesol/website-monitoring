'use client';

import { useEffect, useState, useRef } from 'react';
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
  Modal,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type { TelegramAccount, SignalAccount, EmailRecipient, SmtpConfig, AlertSettings } from '../../../lib/types';
import {
  getSignalQRCodeUrl,
  getSignalAccounts,
  syncSignalAccounts,
  toggleGroupAlerts,
  deleteSignalAccount,
} from '../../../lib/signal-client';
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

  const [activeTab, setActiveTab] = useState('telegram');
  const [telegramAccounts, setTelegramAccounts] = useState<TelegramAccount[] | null>(null);
  const [newTgLabel, setNewTgLabel] = useState('');
  const [newTgToken, setNewTgToken] = useState('');
  const [newTgChat, setNewTgChat] = useState('');
  const [addingTg, setAddingTg] = useState(false);

  const [signalAccounts, setSignalAccounts] = useState<SignalAccount[] | null>(null);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isSyncingSignal, setIsSyncingSignal] = useState(false);
  const [unlinkingPhone, setUnlinkingPhone] = useState<string | null>(null);
  const [togglingGroupId, setTogglingGroupId] = useState<string | null>(null);
  const initialPhonesRef = useRef<Set<string>>(new Set());

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
  const [repeatInterval, setRepeatInterval] = useState(300);
  const [recoveryAlert, setRecoveryAlert] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    async function load() {
      const [tg, sigAccounts, ns] = await Promise.all([
        apiFetch<TelegramAccount[]>('settings/telegram-accounts'),
        getSignalAccounts().catch(() => []),
        apiFetch<AlertSettings>('settings/alerts'),
      ]);
      setTelegramAccounts(tg);
      setSignalAccounts(Array.isArray(sigAccounts) ? sigAccounts : []);
      setSettings(ns);
      setRepeatInterval(ns.repeatIntervalSeconds ?? 300);
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

  async function loadSignalAccounts() {
    try {
      const accounts = await getSignalAccounts();
      setSignalAccounts(Array.isArray(accounts) ? accounts : []);
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not load Signal accounts',
        message: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleSyncSignal() {
    setIsSyncingSignal(true);
    try {
      const res = await syncSignalAccounts();
      await loadSignalAccounts();
      toast({
        type: 'success',
        title: 'Signal sync completed',
        message: `Synced ${res.accountsSynced} account(s) and ${res.groupsSynced} group(s).`,
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to sync with Signal bridge',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsSyncingSignal(false);
    }
  }

  function openSignalQR() {
    initialPhonesRef.current = new Set((signalAccounts || []).map((a) => a.phoneNumber));
    const url = getSignalQRCodeUrl();
    setQrCodeUrl(url);
    setIsQRModalOpen(true);
  }

  // Auto-detect linked device while QR modal is open
  useEffect(() => {
    if (!isQRModalOpen) return;

    let isPolling = false;
    const initialPhones = initialPhonesRef.current;

    const pollInterval = setInterval(async () => {
      if (isPolling) return;
      isPolling = true;
      try {
        const syncRes = await syncSignalAccounts();
        const accounts = await getSignalAccounts();
        const accList = Array.isArray(accounts) ? accounts : [];

        const hasNewAccount = accList.some((acc) => !initialPhones.has(acc.phoneNumber));
        if (hasNewAccount || (initialPhones.size === 0 && accList.length > 0)) {
          setSignalAccounts(accList);
          setIsQRModalOpen(false);
          setQrCodeUrl(null);
          toast({
            type: 'success',
            title: 'Signal account connected!',
            message: `Discovered ${syncRes.accountsSynced} account(s) and ${syncRes.groupsSynced} group(s).`,
          });
        }
      } catch {
        // Silently continue polling until scan completes or user closes modal
      } finally {
        isPolling = false;
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isQRModalOpen, toast]);

  // Keep Signal tab auto-synced (discovers new groups and auto-removes unlinked accounts)
  useEffect(() => {
    if (activeTab !== 'signal' || isQRModalOpen) return;

    // Trigger sync immediately upon entering the Signal tab
    syncSignalAccounts()
      .then(async () => {
        const accounts = await getSignalAccounts();
        setSignalAccounts(Array.isArray(accounts) ? accounts : []);
      })
      .catch(() => {
        loadSignalAccounts();
      });

    // Auto-sync every 10 seconds while on the Signal tab
    const interval = setInterval(async () => {
      try {
        await syncSignalAccounts();
        const accounts = await getSignalAccounts();
        setSignalAccounts(Array.isArray(accounts) ? accounts : []);
      } catch {
        // Silently catch background poll errors
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [activeTab, isQRModalOpen]);

  async function handleCloseQRModal() {
    setIsQRModalOpen(false);
    setQrCodeUrl(null);
    setIsSyncingSignal(true);
    try {
      const res = await syncSignalAccounts();
      const accounts = await getSignalAccounts();
      setSignalAccounts(Array.isArray(accounts) ? accounts : []);
      if (res.accountsSynced > 0) {
        toast({
          type: 'success',
          title: 'Signal sync completed',
          message: `Synced ${res.accountsSynced} account(s) and ${res.groupsSynced} group(s).`,
        });
      }
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not sync Signal account',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setIsSyncingSignal(false);
    }
  }

  async function handleToggleGroup(groupId: string, groupName: string | null, currentReceiveAlerts: boolean) {
    const nextVal = !currentReceiveAlerts;
    setTogglingGroupId(groupId);
    try {
      await toggleGroupAlerts(groupId, nextVal);
      setSignalAccounts((prev) =>
        prev
          ? prev.map((acc) => ({
              ...acc,
              groups: acc.groups.map((g) => (g.id === groupId ? { ...g, receiveAlerts: nextVal } : g)),
            }))
          : []
      );
      toast({
        type: 'success',
        title: nextVal ? 'Alerts enabled' : 'Alerts disabled',
        message: `${groupName || 'Group'} will ${nextVal ? 'now receive' : 'no longer receive'} alerts.`,
      });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Failed to update group alert settings',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setTogglingGroupId(null);
    }
  }

  async function handleUnlinkAccount(phoneNumber: string) {
    if (!confirm(`Are you sure you want to unlink Signal account ${phoneNumber}?`)) return;
    setUnlinkingPhone(phoneNumber);
    try {
      await deleteSignalAccount(phoneNumber);
      setSignalAccounts((prev) => (prev ? prev.filter((a) => a.phoneNumber !== phoneNumber) : []));
      toast({ type: 'info', title: 'Signal account unlinked', message: phoneNumber });
    } catch (err) {
      toast({
        type: 'error',
        title: 'Could not unlink account',
        message: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setUnlinkingPhone(null);
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
        body: JSON.stringify({
          repeatIntervalSeconds: repeatInterval,
          recoveryAlertEnabled: recoveryAlert,
        }),
      });
      setSettings(updated);
      toast({ type: 'success', title: 'Settings saved', message: 'Alert behavior updated' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not save settings', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSettings(false);
    }
  }

  const loading = telegramAccounts === null || signalAccounts === null || settings === null || (EMAIL_ENABLED && emailRecipients === null);

  return (
    <PermissionGate permission="notifications:view">
      <Topbar>
        <Breadcrumb section={breadcrumbSiteName} page="Notifications" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card className="max-w-[700px]">
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Where alerts go when a monitor goes down</CardDescription>
          </CardHeader>

          {loading ? (
            <div className="px-6 pb-6 text-sm text-text-muted">Loading…</div>
          ) : (
            <div className="px-5 pb-5">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
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
                  <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <SubHeading>Connected Signal Accounts</SubHeading>
                      <p className="text-[13px] text-text-muted">
                        Link Signal accounts and select which groups will receive uptime and downtime alerts.
                      </p>
                    </div>
                    {canUpdate ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSyncSignal}
                          disabled={isSyncingSignal}
                        >
                          {isSyncingSignal ? 'Syncing…' : 'Sync Groups'}
                        </Button>
                        <Button size="sm" onClick={openSignalQR} disabled={isSyncingSignal}>
                          + Link Signal Account
                        </Button>
                      </div>
                    ) : null}
                  </div>

                  {signalAccounts === null ? (
                    <div className="py-6 text-center text-[13px] text-text-muted">Loading Signal accounts…</div>
                  ) : signalAccounts.length === 0 ? (
                    <div className="rounded border border-dashed border-border p-8 text-center bg-bg-secondary/40">
                      <div className="mb-2 text-sm font-medium text-text">No Signal accounts linked yet</div>
                      <p className="mb-4 text-xs text-text-muted max-w-sm mx-auto">
                        Link a Signal account by scanning a QR code with your phone. Once connected, your Signal groups will appear here and you can enable alerts for selected groups.
                      </p>
                      {canUpdate ? (
                        <Button size="sm" onClick={openSignalQR}>
                          Link Signal Account
                        </Button>
                      ) : null}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {signalAccounts.map((account) => (
                        <div
                          key={account.id}
                          className="rounded border border-border bg-bg-secondary p-4 space-y-3"
                        >
                          <div className="flex items-center justify-between pb-3 border-b border-border">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-sm font-semibold text-text">{account.phoneNumber}</span>
                              <Badge status="up" label="Connected" />
                            </div>
                            {canUpdate ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => handleUnlinkAccount(account.phoneNumber)}
                                disabled={unlinkingPhone === account.phoneNumber}
                              >
                                {unlinkingPhone === account.phoneNumber ? 'Unlinking…' : 'Unlink'}
                              </Button>
                            ) : null}
                          </div>

                          <div>
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-subtle">
                              Groups ({account.groups.length})
                            </div>
                            {account.groups.length === 0 ? (
                              <div className="py-2 text-xs text-text-muted italic">
                                No groups found for this account. Create or join a Signal group, then click &quot;Sync Groups&quot;.
                              </div>
                            ) : (
                              <div className="divide-y divide-border/60 rounded border border-border bg-bg">
                                {account.groups.map((group) => (
                                  <div
                                    key={group.id}
                                    className="flex items-center justify-between px-3 py-2.5 hover:bg-bg-secondary/40 transition-colors"
                                  >
                                    <div className="min-w-0 pr-4">
                                      <div className="text-[13px] font-medium text-text truncate">
                                        {group.name || 'Unnamed Group'}
                                      </div>
                                      <div className="font-mono text-[10px] text-text-subtle truncate">
                                        {group.groupId}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 shrink-0">
                                      <span className="text-xs text-text-muted">
                                        {group.receiveAlerts ? 'Alerts ON' : 'Alerts OFF'}
                                      </span>
                                      <Toggle
                                        checked={group.receiveAlerts}
                                        onCheckedChange={() =>
                                          handleToggleGroup(group.id, group.name, group.receiveAlerts)
                                        }
                                        disabled={!canUpdate || togglingGroupId === group.id}
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 rounded border border-border/60 bg-bg-secondary/30 p-3 text-xs text-text-muted leading-relaxed">
                    <strong>Note:</strong> Alerts are only dispatched to groups where &quot;Alerts ON&quot; is toggled. Signal groups without active toggle will never receive alert messages.
                  </div>
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
                  <div className="space-y-4">
                    <div>
                      <FieldLabel>Repeat alert every</FieldLabel>
                      <div className="flex w-fit items-stretch">
                        <Input
                          type="number"
                          min={30}
                          max={86400}
                          value={repeatInterval}
                          onChange={(e) => setRepeatInterval(Number(e.target.value))}
                          className="w-[120px] rounded-r-none border-r-0"
                          disabled={!canUpdate}
                        />
                        <span className="flex items-center rounded rounded-l-none border border-border-strong bg-bg-muted px-3 text-[13px] text-text-muted">
                          seconds
                        </span>
                      </div>
                      <Hint>How often to re-send while a site is still down.</Hint>
                    </div>

                    <div>
                      <FieldLabel>Send recovery alert</FieldLabel>
                      <div className="mt-1.5 flex items-center gap-2.5">
                        <Toggle checked={recoveryAlert} onCheckedChange={setRecoveryAlert} disabled={!canUpdate} />
                        <span className="text-[13px] text-text-muted">Notify when a downed monitor comes back online</span>
                      </div>
                    </div>
                  </div>

                  {canUpdate ? (
                    <Button className="mt-5" onClick={saveAlertBehavior} disabled={savingSettings}>
                      {savingSettings ? 'Saving…' : 'Save settings'}
                    </Button>
                  ) : null}
                </TabsContent>
              </Tabs>
            </div>
          )}
        </Card>

        {/* Signal QR Linking Modal */}
        <Modal
          open={isQRModalOpen}
          onClose={handleCloseQRModal}
          title="Link Signal Account"
          description="Link your Signal account by scanning this QR code in the Signal mobile app."
          footer={
            <Button size="sm" onClick={handleCloseQRModal} className="w-full">
              Done / Close
            </Button>
          }
        >
          <div className="flex flex-col items-center justify-center p-4">
            <div className="p-3 bg-white rounded-lg border border-border shadow-sm mb-3">
              {qrCodeUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={qrCodeUrl}
                  alt="Signal Linking QR Code"
                  className="w-60 h-60 object-contain"
                />
              ) : (
                <div className="w-60 h-60 flex items-center justify-center text-text-muted">
                  Loading QR code…
                </div>
              )}
            </div>
            <p className="text-xs text-text-muted text-center max-w-xs leading-relaxed">
              In Signal on your phone, go to <strong>Settings &gt; Linked Devices &gt; Link New Device</strong>, then scan the QR code above.
            </p>
            <p className="text-[11px] text-text-subtle text-center mt-1.5">
              The QR code expires quickly. Close this dialog after scanning.
            </p>
          </div>
        </Modal>
      </div>
    </PermissionGate>
  );
}
