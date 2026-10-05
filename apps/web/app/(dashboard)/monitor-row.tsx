'use client';

import {
  Badge,
  Toggle,
  HistoryBars,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
  useToast,
  type HistoryStatus,
} from '@uptime/ui';
import { apiFetch } from '../../lib/api-client';
import { timeAgo, responseTimeClass, formatResponseTime, uptimeColorClass, stripProtocol } from '../../lib/format';
import { isSlowMonitor, monitorStatus, type MonitorWithStatus } from '../../lib/types';

const HISTORY_SIZE = 30;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return url;
  }
}

function padHistory(history: Array<'up' | 'down'>): HistoryStatus[] {
  const padded: HistoryStatus[] = Array(Math.max(0, HISTORY_SIZE - history.length)).fill('unknown');
  return [...padded, ...history].slice(-HISTORY_SIZE);
}

const STATUS_LABEL: Record<ReturnType<typeof monitorStatus>, string> = {
  up: 'Online',
  down: 'Down',
  paused: 'Paused',
  checking: 'Checking…',
};

function CheckNowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}
function ExternalLinkIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function MonitorRow({
  monitor,
  canUpdate,
  canDelete,
  onChanged,
  onEditRequested,
  onDeleteRequested,
}: {
  monitor: MonitorWithStatus;
  canUpdate: boolean;
  canDelete: boolean;
  onChanged: () => void;
  onEditRequested: (monitor: MonitorWithStatus) => void;
  onDeleteRequested: (monitor: MonitorWithStatus) => void;
}) {
  const toast = useToast();
  const status = monitorStatus(monitor);
  const urlShort = stripProtocol(monitor.domain);
  const rt = monitor.latestCheck?.responseTimeMs ?? null;
  const slow = isSlowMonitor(monitor);
  // Only worth showing when the site really ended up somewhere other than the
  // address we monitor (a plain http→https or www hop to the same host isn't news).
  const finalUrl = monitor.latestCheck?.finalUrl ?? null;
  const redirectedTo =
    finalUrl && (monitor.latestCheck?.redirectCount ?? 0) > 0 && hostOf(finalUrl) !== hostOf(`https://${monitor.domain}`)
      ? finalUrl
      : null;

  async function togglePause(nextEnabled: boolean) {
    try {
      await apiFetch(`monitors/${monitor.id}/${nextEnabled ? 'resume' : 'pause'}`, { method: 'POST' });
      toast({
        type: 'info',
        title: nextEnabled ? 'Monitoring resumed' : 'Monitoring paused',
        message: monitor.label || urlShort,
      });
      onChanged();
    } catch (err) {
      toast({ type: 'error', title: 'Could not update monitor', message: err instanceof Error ? err.message : undefined });
    }
  }

  async function checkNow() {
    try {
      await apiFetch(`monitors/${monitor.id}/check-now`, { method: 'POST' });
      toast({ type: 'info', title: 'Check queued', message: `${monitor.label || urlShort} will be checked shortly` });
      onChanged();
    } catch (err) {
      toast({ type: 'error', title: 'Could not queue check', message: err instanceof Error ? err.message : undefined });
    }
  }

  function copyUrl() {
    const text = `https://${monitor.domain}`;
    // navigator.clipboard requires a secure context (HTTPS or localhost) —
    // unavailable on a plain-HTTP deployment, where it throws synchronously
    // instead of rejecting. Fall back to the older execCommand approach,
    // which still works over HTTP.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => toast({ type: 'success', title: 'Copied', message: text }));
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    try {
      document.execCommand('copy');
      toast({ type: 'success', title: 'Copied', message: text });
    } catch {
      toast({ type: 'error', title: 'Could not copy', message: text });
    } finally {
      document.body.removeChild(textarea);
    }
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-secondary">
      <td className="px-5 py-2.5">
        <Toggle
          checked={!monitor.isPaused}
          onCheckedChange={togglePause}
          disabled={!canUpdate}
          aria-label={monitor.isPaused ? 'Resume monitoring' : 'Pause monitoring'}
        />
      </td>
      <td className="px-5 py-2.5">
        <div className="text-[13.5px] font-medium text-text">{monitor.label || urlShort}</div>
        <a
          href={`https://${monitor.domain}`}
          target="_blank"
          rel="noopener noreferrer"
          title={`Open https://${monitor.domain} in a new tab`}
          className="inline-flex items-center gap-1 font-mono text-xs text-text-muted hover:text-accent hover:underline"
        >
          {urlShort}
          <ExternalLinkIcon />
        </a>
        {redirectedTo ? (
          <div
            className="max-w-[260px] truncate font-mono text-[11px] text-text-subtle"
            title={`Redirects (${monitor.latestCheck?.redirectCount}×) to ${redirectedTo}`}
          >
            → {stripProtocol(redirectedTo)}
          </div>
        ) : null}
      </td>
      <td className="px-5 py-2.5">
        {slow ? (
          <Badge status="slow" label="Slow" title={`Responded in ${formatResponseTime(rt ?? 0)} — slower than the threshold in Settings`} />
        ) : (
          <Badge status={status} label={STATUS_LABEL[status]} />
        )}
        {status === 'down' && monitor.latestCheck?.error ? (
          <div className="mt-1 max-w-[220px] truncate text-xs text-text-muted" title={monitor.latestCheck.error}>
            {monitor.latestCheck.error}
          </div>
        ) : null}
      </td>
      <td className="px-5 py-2.5">
        {rt === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className={`font-mono text-[12.5px] ${responseTimeClass(rt)}`}>{formatResponseTime(rt)}</span>
        )}
      </td>
      <td className="px-5 py-2.5">
        <span className="text-xs text-text-muted">{timeAgo(monitor.latestCheck?.timestamp)}</span>
      </td>
      <td className="px-5 py-2.5">
        <HistoryBars history={padHistory(monitor.history)} />
      </td>
      <td className="px-5 py-2.5">
        <span className={`font-mono text-[12.5px] font-medium ${uptimeColorClass(monitor.uptime24h)}`}>
          {monitor.uptime24h === null ? '—' : `${monitor.uptime24h.toFixed(1)}%`}
        </span>
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-0.5">
          {canUpdate ? (
            <Button variant="ghost" size="sm" className="p-1.5" title="Check now" onClick={checkNow}>
              <CheckNowIcon />
            </Button>
          ) : null}
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1.5">
                <DotsIcon />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onClick={copyUrl}>Copy URL</DropdownItem>
              <DropdownItem onClick={() => window.open(`https://${monitor.domain}`, '_blank', 'noopener')}>
                Open site
              </DropdownItem>
              {canUpdate ? (
                <DropdownItem onClick={() => onEditRequested(monitor)}>
                  <EditIcon />
                  Edit
                </DropdownItem>
              ) : null}
              {canDelete ? (
                <>
                  <DropdownSeparator />
                  <DropdownItem danger onClick={() => onDeleteRequested(monitor)}>
                    Remove
                  </DropdownItem>
                </>
              ) : null}
            </DropdownContent>
          </Dropdown>
        </div>
      </td>
    </tr>
  );
}
