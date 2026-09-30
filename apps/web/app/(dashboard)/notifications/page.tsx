'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
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
  ConfirmDialog,
  IncidentBanner,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import type {
  TelegramAccount,
  SignalConfig,
  SignalRecipientNumber,
  EmailRecipient,
  SmtpConfig,
  AlertSettings,
} from '../../../lib/types';
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

// Signal alerts are group-only for now (product decision) — fallback numbers
// are hidden rather than removed: the SignalRecipientNumber backend/CRUD/state
// below is untouched, so flipping this back to true is the whole re-enable
// step, symmetric with apps/worker's AlertsService.sendSignalAlert() which
// has the matching flag/comment on its own group-only simplification.
const SIGNAL_FALLBACK_NUMBERS_ENABLED = false;

/** Mirrors apps/api's `GET settings/signal-config/status` response shape. */
type SignalStatusResponse =
  | { state: 'not_configured' }
  | { state: 'sidecar_unreachable'; detail: string }
  | {
      state: 'connected';
      senderNumber: string;
      isActive: boolean;
      deviceName?: string;
      linkedAt?: string;
      recipientGroupId?: string;
      recipientGroupName?: string;
    };

type SignalUiStatus = 'not_configured' | 'connected' | 'sidecar_unreachable' | 'connecting';

/** Mirrors apps/api's `GET settings/signal-config/groups` response shape. */
interface SignalGroupSummary {
  id: string;
  name: string;
}

/** Sentinel `<select>`/`Select` value meaning "no group selected — no Signal alerts will be sent". */
const SIGNAL_NO_GROUP = 'none';

/**
 * Formats an E.164 number (e.g. `+923209737896`) into a properly
 * country-code-separated international display form (e.g. `+92 320 9737896`).
 * Never throws — falls back to the raw string unchanged if parsing fails.
 */
function formatPhoneNumber(raw: string): string {
  try {
    return parsePhoneNumberFromString(raw)?.formatInternational() ?? raw;
  } catch {
    return raw;
  }
}

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

  const [activeTab, setActiveTab] = useState('telegram');

  // `null` = status not fetched yet (brief initial load only — the mount
  // effect below awaits it alongside the other tabs' data).
  const [signalStatus, setSignalStatus] = useState<SignalUiStatus | null>(null);
  const [signalStatusDetail, setSignalStatusDetail] = useState<string | null>(null);
  const [signalSenderNumber, setSignalSenderNumber] = useState('');
  const [signalDeviceName, setSignalDeviceName] = useState<string | null>(null);
  const [signalLinkedAt, setSignalLinkedAt] = useState<string | null>(null);
  const [signalActive, setSignalActive] = useState(true);
  const [savingSignal, setSavingSignal] = useState(false);
  // Fallback phone-number list — a real add/remove list now, same pattern as
  // `emailRecipients` below, replacing the old single `recipientNumber` field
  // on `SignalConfig` (backend now stores these as `SignalRecipientNumber` rows).
  const [signalRecipientNumbers, setSignalRecipientNumbers] = useState<SignalRecipientNumber[] | null>(null);
  const [newSignalRecipientNumber, setNewSignalRecipientNumber] = useState('');
  const [addingSignalRecipientNumber, setAddingSignalRecipientNumber] = useState(false);
  // Signal-group picker state — independent of the plain-number fields above.
  // `signalGroups === null` means "not fetched yet"; a failed fetch leaves it
  // `null` too, retried on the next status-fetch cadence tick (see
  // fetchSignalStatus) rather than looping on its own.
  const [signalGroups, setSignalGroups] = useState<SignalGroupSummary[] | null>(null);
  const [signalGroupsError, setSignalGroupsError] = useState<string | null>(null);
  const [loadingSignalGroups, setLoadingSignalGroups] = useState(false);
  const [refreshingSignalGroups, setRefreshingSignalGroups] = useState(false);
  // The picker's current selection — `SIGNAL_NO_GROUP` or a group id. Synced
  // from the server's `recipientGroupId` on every status fetch.
  const [signalSelectedGroupId, setSignalSelectedGroupId] = useState<string>(SIGNAL_NO_GROUP);
  // Which group is ACTUALLY active right now, per the last status fetch —
  // deliberately separate from the picker's own selection state above so the
  // "sending alerts to" display never reflects an unsaved selection. `null`
  // means no group is selected — a valid, intentional "no alerts" state now
  // that Signal alerts are group-only (see SIGNAL_FALLBACK_NUMBERS_ENABLED).
  const [signalActiveRecipient, setSignalActiveRecipient] = useState<{ name: string } | null>(null);
  // Set when a background status re-fetch sees a previously-`connected` link
  // silently drop to `not_configured` (not via the user's own Disconnect
  // click, which sets state directly instead of going through this path) —
  // drives the cross-cutting "reconnect Signal" banner.
  const [signalDroppedBanner, setSignalDroppedBanner] = useState(false);
  const [signalBannerDismissed, setSignalBannerDismissed] = useState(false);
  const prevSignalStatusRef = useRef<SignalUiStatus | null>(null);

  const [signalLinkModalOpen, setSignalLinkModalOpen] = useState(false);
  const [signalQrDataUrl, setSignalQrDataUrl] = useState<string | null>(null);
  const [signalQrRefreshing, setSignalQrRefreshing] = useState(false);
  const [signalQrError, setSignalQrError] = useState<string | null>(null);
  const [signalQrRetryTick, setSignalQrRetryTick] = useState(0);
  const [signalDisconnectConfirmOpen, setSignalDisconnectConfirmOpen] = useState(false);
  const [disconnectingSignal, setDisconnectingSignal] = useState(false);
  const [sendingSignalTest, setSendingSignalTest] = useState(false);
  const signalTabRef = useRef<HTMLDivElement>(null);

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
      const [tg, , ns] = await Promise.all([
        apiFetch<TelegramAccount[]>('settings/telegram-accounts'),
        fetchSignalStatus(),
        apiFetch<AlertSettings>('settings/alerts'),
      ]);
      setTelegramAccounts(tg);
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
    // Load once — this page has no live-updating data, EXCEPT Signal's connection
    // status, which is a live external system re-fetched on its own below (tab
    // focus/switch + a light poll), independent of this one-shot mount load.
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

  // Fetches the live link status from the Signal sidecar. Called on mount
  // (as part of the page's one-shot load), whenever the Signal tab becomes
  // active/focused, and on a light background poll — see the effects below.
  // Detects a `connected` → `not_configured` flip (a link silently dropping)
  // to drive the cross-cutting "reconnect Signal" banner; disconnectSignal()
  // below bypasses this by updating state directly, since that flip is
  // expected/deliberate there, not a silent drop.
  //
  // Also piggybacks the group-list fetch onto this exact same cadence (mount,
  // tab focus, window focus, background poll) rather than a separate
  // "fetch once on becoming connected" effect — a background job now keeps
  // the group cache synced server-side every ~60s, so there's no manual
  // "Refresh groups" button anymore; the picker just stays fresh for free.
  async function fetchSignalStatus() {
    try {
      const result = await apiFetch<SignalStatusResponse>('settings/signal-config/status');
      if (prevSignalStatusRef.current === 'connected' && result.state === 'not_configured') {
        setSignalDroppedBanner(true);
      }
      if (result.state === 'connected') {
        setSignalDroppedBanner(false);
        setSignalBannerDismissed(false);
        setSignalSenderNumber(result.senderNumber);
        setSignalActive(result.isActive);
        setSignalDeviceName(result.deviceName ?? null);
        setSignalLinkedAt(result.linkedAt ?? null);
        setSignalStatusDetail(null);
        setSignalSelectedGroupId(result.recipientGroupId ?? SIGNAL_NO_GROUP);
        setSignalActiveRecipient(
          result.recipientGroupId ? { name: result.recipientGroupName ?? result.recipientGroupId } : null
        );
        void fetchSignalGroups();
      } else if (result.state === 'sidecar_unreachable') {
        setSignalStatusDetail(result.detail);
      } else {
        setSignalStatusDetail(null);
      }
      prevSignalStatusRef.current = result.state;
      setSignalStatus(result.state);
    } catch {
      // Background/poll-style fetch — a toast on every failed tick would be noisy.
      // The initial mount call surfaces failures via `load()`'s own catch.
    }
  }

  // Fetches the Signal group list for the picker. Called from fetchSignalStatus()
  // above every time it observes the `connected` state — i.e. on the exact
  // same cadence as status itself (mount, tab focus, window focus, background
  // poll). Errors go into a small inline message rather than a toast — this
  // call can fail transiently (sidecar blip) and shouldn't read as alarming.
  async function fetchSignalGroups() {
    setLoadingSignalGroups(true);
    setSignalGroupsError(null);
    try {
      const { groups } = await apiFetch<{ groups: SignalGroupSummary[] }>('settings/signal-config/groups');
      setSignalGroups(groups);
    } catch (err) {
      setSignalGroupsError(err instanceof Error ? err.message : 'Could not load Signal groups');
    } finally {
      setLoadingSignalGroups(false);
    }
  }

  // Manual "Refresh now" — the background sync only runs every ~60s, so this
  // enqueues an immediate one-off run (apps/worker's existing consumer
  // processes it, same job/queue as the repeatable one) and then re-fetches
  // the cache shortly after, rather than just re-reading whatever's already
  // cached (which could be up to a minute stale).
  async function refreshSignalGroups() {
    setRefreshingSignalGroups(true);
    try {
      await apiFetch('settings/signal-config/groups/sync', { method: 'POST' });
      // The sync job normally finishes in well under a second (the worker is
      // idle between its own ticks) — a short delay before re-fetching avoids
      // a race where we'd read the cache before the job has actually run.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await fetchSignalGroups();
    } catch (err) {
      toast({ type: 'error', title: 'Could not refresh Signal groups', message: err instanceof Error ? err.message : undefined });
    } finally {
      setRefreshingSignalGroups(false);
    }
  }

  // Saves only the Signal-group selection — `PUT settings/signal-config` no
  // longer accepts/touches `recipientNumber` at all (fallback numbers are now
  // managed as their own list via the recipient-numbers endpoints below, hidden
  // behind SIGNAL_FALLBACK_NUMBERS_ENABLED). "None" is a perfectly valid save
  // here: alerts are group-only, so no group selected just means no alerts.
  async function saveSignalGroup() {
    const usingGroup = signalSelectedGroupId !== SIGNAL_NO_GROUP;
    setSavingSignal(true);
    try {
      const selectedGroup = usingGroup ? (signalGroups ?? []).find((g) => g.id === signalSelectedGroupId) : undefined;
      await apiFetch('settings/signal-config', {
        method: 'PUT',
        body: JSON.stringify({
          senderNumber: signalSenderNumber,
          recipientGroupId: usingGroup ? (selectedGroup?.id ?? signalSelectedGroupId) : null,
          recipientGroupName: usingGroup ? (selectedGroup?.name ?? null) : null,
          isActive: signalActive,
        }),
      });
      toast({ type: 'success', title: 'Signal group selection saved' });
      // Re-fetch rather than trust this response directly — status re-validates
      // a group recipient against the sidecar's live list, which is the same
      // source of truth the "sending alerts to" pill/warning above reads from.
      await fetchSignalStatus();
    } catch (err) {
      toast({ type: 'error', title: 'Could not save Signal group selection', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSavingSignal(false);
    }
  }

  async function toggleSignalActive(checked: boolean) {
    const previous = signalActive;
    setSignalActive(checked);
    try {
      const updated = await apiFetch<SignalConfig>('settings/signal-config', {
        method: 'PUT',
        body: JSON.stringify({
          senderNumber: signalSenderNumber,
          isActive: checked,
        }),
      });
      setSignalActive(updated.isActive);
    } catch (err) {
      setSignalActive(previous);
      toast({ type: 'error', title: 'Could not update Signal', message: err instanceof Error ? err.message : undefined });
    }
  }

  async function sendSignalTest() {
    setSendingSignalTest(true);
    try {
      await apiFetch<{ sent: true }>('settings/signal-config/test-send', { method: 'POST' });
      toast({ type: 'success', title: 'Test message sent' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not send test message', message: err instanceof Error ? err.message : undefined });
    } finally {
      setSendingSignalTest(false);
    }
  }

  async function disconnectSignal() {
    setDisconnectingSignal(true);
    try {
      await apiFetch('settings/signal-config/disconnect', { method: 'POST' });
      setSignalDisconnectConfirmOpen(false);
      // Set directly rather than re-fetching through fetchSignalStatus() —
      // this is a deliberate user action, not the silent drop that function
      // watches for, and calling it here would false-positive the banner.
      prevSignalStatusRef.current = 'not_configured';
      setSignalStatus('not_configured');
      setSignalStatusDetail(null);
      setSignalDroppedBanner(false);
      toast({ type: 'info', title: 'Signal disconnected' });
    } catch (err) {
      toast({ type: 'error', title: 'Could not disconnect Signal', message: err instanceof Error ? err.message : undefined });
    } finally {
      setDisconnectingSignal(false);
    }
  }

  // Mirrors addEmailRecipient()/removeEmailRecipient() exactly — same
  // validation-before-send, same optimistic local-array update on success,
  // same toast wording style, just a phone number instead of an email.
  async function addSignalRecipientNumber() {
    if (!newSignalRecipientNumber.trim()) {
      toast({ type: 'error', title: 'Phone number required' });
      return;
    }
    setAddingSignalRecipientNumber(true);
    try {
      const created = await apiFetch<SignalRecipientNumber>('settings/signal-config/recipient-numbers', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: newSignalRecipientNumber.trim() }),
      });
      setSignalRecipientNumbers((prev) => [...(prev ?? []), created]);
      setNewSignalRecipientNumber('');
      toast({ type: 'success', title: 'Fallback number added', message: created.phoneNumber });
    } catch (err) {
      toast({ type: 'error', title: 'Could not add fallback number', message: err instanceof Error ? err.message : undefined });
    } finally {
      setAddingSignalRecipientNumber(false);
    }
  }

  async function removeSignalRecipientNumber(id: string, phoneNumber: string) {
    try {
      await apiFetch(`settings/signal-config/recipient-numbers/${id}`, { method: 'DELETE' });
      setSignalRecipientNumbers((prev) => (prev ?? []).filter((n) => n.id !== id));
      toast({ type: 'info', title: 'Removed', message: phoneNumber });
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove fallback number', message: err instanceof Error ? err.message : undefined });
    }
  }

  function openSignalLinkModal() {
    setSignalQrDataUrl(null);
    setSignalQrError(null);
    setSignalStatus('connecting');
    setSignalLinkModalOpen(true);
  }

  // Any close of the link modal — success, Escape, overlay click, Cancel —
  // re-fetches the real status so `connecting` never gets stuck if the user
  // backs out before scanning.
  function closeSignalLinkModal() {
    setSignalLinkModalOpen(false);
    fetchSignalStatus();
  }

  // Fetches the QR code + polls link status while the modal is open; tears
  // both intervals down on close/unmount (success, Escape, overlay click, or
  // the component unmounting) so nothing leaks.
  useEffect(() => {
    if (!signalLinkModalOpen) return;
    let cancelled = false;

    async function fetchQr(isRefresh: boolean) {
      if (isRefresh) setSignalQrRefreshing(true);
      try {
        // No deviceName query param — let the backend's own fixed default
        // apply, so the same name is used both when generating this QR code
        // and when signal-connect.service.ts later looks up "our" device
        // among possibly several linked to the same number.
        const { dataUrl } = await apiFetch<{ dataUrl: string }>('settings/signal-config/link/qrcode');
        if (!cancelled) {
          setSignalQrDataUrl(dataUrl);
          setSignalQrError(null);
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Could not load the QR code';
          // On the FIRST fetch there's no QR shown yet at all — the modal must show
          // this error instead of spinning forever (there's no image to fall back
          // to). On a background refresh, keep showing the last good QR rather
          // than replacing it with an error — just toast, matching a transient blip.
          if (isRefresh) {
            toast({ type: 'error', title: 'Could not refresh QR code', message });
          } else {
            setSignalQrError(message);
          }
        }
      } finally {
        if (!cancelled && isRefresh) setSignalQrRefreshing(false);
      }
    }

    async function pollLinkStatus() {
      try {
        const result = await apiFetch<{ linked: boolean; senderNumber?: string }>('settings/signal-config/link/status');
        if (!cancelled && result.linked) {
          cancelled = true;
          clearInterval(qrTimer);
          clearInterval(pollTimer);
          setSignalLinkModalOpen(false);
          toast({
            type: 'success',
            title: 'Signal linked',
            message: result.senderNumber ? `Connected as ${result.senderNumber}` : undefined,
          });
          fetchSignalStatus();
        }
      } catch {
        // Transient poll failure — keep trying on the next tick rather than toasting every 2-3s.
      }
    }

    fetchQr(false);
    const qrTimer = setInterval(() => fetchQr(true), 50000);
    const pollTimer = setInterval(pollLinkStatus, 2500);

    return () => {
      cancelled = true;
      clearInterval(qrTimer);
      clearInterval(pollTimer);
    };
    // Keyed on signalLinkModalOpen + signalQrRetryTick only — re-running this
    // effect on every render (e.g. from fetchSignalStatus/toast being
    // re-created) would restart both timers instead of letting them run
    // their full interval. signalQrRetryTick is a deliberate manual bump
    // (Retry button) to force a fresh attempt after a failed initial fetch.
  }, [signalLinkModalOpen, signalQrRetryTick]);

  // Signal is a live external system that can change without any action in
  // this UI, so its status is re-fetched beyond just the initial mount load:
  // whenever this tab becomes active, whenever the window regains focus, and
  // on a light background poll (this last one is what lets the cross-cutting
  // banner notice a link dropping while the user isn't even looking at this tab).
  useEffect(() => {
    if (activeTab === 'signal') fetchSignalStatus();
  }, [activeTab]);

  // Fallback phone-number list — hidden behind SIGNAL_FALLBACK_NUMBERS_ENABLED
  // (state/effect kept, not deleted). Still on its own "becoming connected
  // while this tab is active" trigger, fetching from its own CRUD endpoint
  // (same pattern as `emailRecipients`).
  useEffect(() => {
    if (activeTab === 'signal' && signalStatus === 'connected' && signalRecipientNumbers === null) {
      apiFetch<SignalRecipientNumber[]>('settings/signal-config/recipient-numbers')
        .then(setSignalRecipientNumbers)
        .catch((err) => toast({ type: 'error', title: 'Could not load fallback numbers', message: err.message }));
    }
  }, [activeTab, signalStatus, signalRecipientNumbers]);

  useEffect(() => {
    function onFocus() {
      fetchSignalStatus();
    }
    window.addEventListener('focus', onFocus);
    const poll = setInterval(fetchSignalStatus, 20000);
    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(poll);
    };
    // Mount-once subscription — fetchSignalStatus is re-created each render but
    // only reads refs/calls setters, so the closure captured here never goes stale.
  }, []);

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

  const loading = telegramAccounts === null || settings === null || (EMAIL_ENABLED && emailRecipients === null);

  return (
    <PermissionGate permission="notifications:view">
      <Topbar>
        <Breadcrumb section={breadcrumbSiteName} page="Notifications" />
      </Topbar>
      <div className="flex-1 p-6">
        <IncidentBanner className="max-w-[560px]">
          {(signalStatus === 'sidecar_unreachable' || signalDroppedBanner) && !signalBannerDismissed ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <span className="font-semibold">Signal alerts aren&apos;t being delivered.</span>{' '}
                <span className="text-red/85">Reconnect Signal to keep receiving downtime alerts.</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setActiveTab('signal');
                    signalTabRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                >
                  Go to Signal
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSignalBannerDismissed(true)}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : null}
        </IncidentBanner>

        <Card className="max-w-[560px]">
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

                <TabsContent value="signal" ref={signalTabRef}>
                  {signalStatus === null ? (
                    <div className="text-[13px] text-text-muted">Loading…</div>
                  ) : signalStatus === 'sidecar_unreachable' ? (
                    <div>
                      <div className="mb-2">
                        <Badge status="down" label="Sidecar unreachable" />
                      </div>
                      <div className="rounded border border-red-border bg-red-bg px-3 py-2.5 text-[13px] text-red">
                        {signalStatusDetail ?? 'The Signal sidecar (signal-cli-rest-api) could not be reached.'}
                      </div>
                      <Hint>Check SIGNAL_REST_API_URL and that the sidecar container is running, then reopen this tab.</Hint>
                    </div>
                  ) : signalStatus === 'connecting' ? (
                    <div className="text-[13px] text-text-muted">Waiting for the QR code to be scanned…</div>
                  ) : signalStatus === 'connected' ? (
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <Badge status="up" label="Connected" />
                        <span className="font-mono text-[13px] text-text">{formatPhoneNumber(signalSenderNumber)}</span>
                      </div>
                      {signalDeviceName ? (
                        <Hint>
                          Linked as <span className="font-medium text-text">{signalDeviceName}</span>
                          {signalLinkedAt
                            ? `, since ${new Date(signalLinkedAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}`
                            : ''}
                        </Hint>
                      ) : null}

                      <div className="mb-3.5 mt-3.5">
                        {signalActiveRecipient ? (
                          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-blue-border bg-blue-bg px-2.5 py-1 text-[12.5px] font-medium text-blue">
                            <span aria-hidden="true">→</span>
                            {signalActiveRecipient.name}
                          </span>
                        ) : (
                          <div className="rounded border border-yellow-border bg-yellow-bg px-3 py-2.5 text-[13px] text-yellow">
                            No recipient selected — Signal alerts won&apos;t be sent until you choose a group below.
                          </div>
                        )}
                      </div>

                      <div className="mb-3.5">
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <FieldLabel>Signal group</FieldLabel>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={refreshSignalGroups}
                            disabled={refreshingSignalGroups}
                          >
                            {refreshingSignalGroups ? 'Refreshing…' : 'Refresh now'}
                          </Button>
                        </div>
                        <Select value={signalSelectedGroupId} onValueChange={setSignalSelectedGroupId} disabled={!canUpdate}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={SIGNAL_NO_GROUP}>None selected — no Signal alerts will be sent</SelectItem>
                            {(signalGroups ?? []).map((group) => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {signalGroupsError ? (
                          <Hint>Couldn&apos;t load groups: {signalGroupsError}</Hint>
                        ) : loadingSignalGroups && signalGroups === null ? (
                          <Hint>Loading Signal groups…</Hint>
                        ) : null}
                      </div>

                      {SIGNAL_FALLBACK_NUMBERS_ENABLED ? (
                        <div className="mb-3.5">
                          <FieldLabel>Fallback phone numbers</FieldLabel>
                          <Hint>
                            These numbers receive alerts whenever no Signal group is selected above (or if a selected group
                            becomes unavailable) — every active number gets the alert independently.
                          </Hint>
                          <div className="mb-2 mt-2 flex flex-col gap-2">
                            {(signalRecipientNumbers ?? []).map((recipient) => (
                              <div
                                key={recipient.id}
                                className="flex items-center justify-between gap-2 rounded border border-border bg-bg-secondary px-3 py-2"
                              >
                                <span className="truncate font-mono text-[13px] text-text">{recipient.phoneNumber}</span>
                                {canUpdate ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeSignalRecipientNumber(recipient.id, recipient.phoneNumber)}
                                  >
                                    Remove
                                  </Button>
                                ) : null}
                              </div>
                            ))}
                            {signalRecipientNumbers !== null && signalRecipientNumbers.length === 0 ? (
                              <div className="text-[13px] text-text-muted">No fallback numbers yet.</div>
                            ) : null}
                          </div>
                          {canUpdate ? (
                            <div className="flex gap-2">
                              <Input
                                value={newSignalRecipientNumber}
                                onChange={(e) => setNewSignalRecipientNumber(e.target.value)}
                                placeholder="+15551111111"
                                className="flex-1"
                              />
                              <Button onClick={addSignalRecipientNumber} disabled={addingSignalRecipientNumber}>
                                {addingSignalRecipientNumber ? 'Adding…' : 'Add'}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mb-4">
                        <FieldLabel>Active</FieldLabel>
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <Toggle checked={signalActive} onCheckedChange={toggleSignalActive} disabled={!canUpdate} />
                          <span className="text-[13px] text-text-muted">Send Signal alerts to the recipient above</span>
                        </div>
                      </div>

                      {canUpdate ? (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={saveSignalGroup} disabled={savingSignal}>
                            {savingSignal ? 'Saving…' : 'Save group selection'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={sendSignalTest} disabled={sendingSignalTest}>
                            {sendingSignalTest ? 'Sending…' : 'Send test message'}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setSignalDisconnectConfirmOpen(true)}>
                            Disconnect
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div>
                      <ol className="mb-4 list-decimal space-y-1.5 pl-5 text-[13px] text-text-muted">
                        <li>Have Signal installed on the phone that will send alerts.</li>
                        <li>
                          Click <span className="font-medium text-text">Link Signal</span> below.
                        </li>
                        <li>Scan the code with that phone: Signal app → Settings → Linked Devices → Link New Device.</li>
                        <li>Set who receives the alerts.</li>
                      </ol>
                      <Button size="sm" onClick={openSignalLinkModal} disabled={!canUpdate}>
                        Link Signal
                      </Button>
                    </div>
                  )}
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
      </div>

      <Modal
        open={signalLinkModalOpen}
        onClose={closeSignalLinkModal}
        title="Link Signal"
        description="Scan this code with the Signal app on the phone that will send alerts."
      >
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex size-[220px] items-center justify-center overflow-hidden rounded border border-border bg-bg-secondary">
            {signalQrDataUrl ? (
              // `data:` URL QR code, not an optimizable Next asset — plain <img>, matching ImageUpload's own pattern.
              <img src={signalQrDataUrl} alt="Signal linking QR code" className="size-full object-contain p-2" />
            ) : signalQrError ? (
              <div className="flex flex-col items-center gap-2 px-3 text-center">
                <Badge status="down" label="Couldn't load QR code" />
                <span className="text-xs text-text-muted">{signalQrError}</span>
                <Button size="sm" variant="outline" onClick={() => setSignalQrRetryTick((n) => n + 1)}>
                  Retry
                </Button>
              </div>
            ) : (
              <span className="text-[13px] text-text-muted">Loading QR code…</span>
            )}
            {signalQrRefreshing ? (
              <div className="absolute inset-0 flex items-center justify-center bg-bg/80 text-[13px] text-text-muted">
                Refreshing…
              </div>
            ) : null}
          </div>
          <ol className="w-full list-decimal space-y-1 pl-5 text-[13px] text-text-muted">
            <li>Have Signal installed on the phone that will send alerts.</li>
            <li>Scan the code above with that phone.</li>
            <li>Signal app → Settings → Linked Devices → Link New Device.</li>
            <li>Set who receives the alerts once linked.</li>
          </ol>
        </div>
      </Modal>

      <ConfirmDialog
        open={signalDisconnectConfirmOpen}
        onClose={() => setSignalDisconnectConfirmOpen(false)}
        onConfirm={disconnectSignal}
        title="Disconnect Signal?"
        description="This unlinks the connected phone number. You'll need to scan a new QR code to reconnect."
        confirmLabel={disconnectingSignal ? 'Disconnecting…' : 'Disconnect'}
      />
    </PermissionGate>
  );
}
