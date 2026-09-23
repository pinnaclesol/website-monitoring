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
import { timeAgo, responseTimeClass, uptimeColorClass, stripProtocol } from '../../lib/format';
import { monitorStatus, type MonitorWithStatus } from '../../lib/types';

const HISTORY_SIZE = 30;

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
    navigator.clipboard
      .writeText(`https://${monitor.domain}`)
      .then(() => toast({ type: 'success', title: 'Copied', message: `https://${monitor.domain}` }));
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
        <div className="font-mono text-xs text-text-muted">{urlShort}</div>
      </td>
      <td className="px-5 py-2.5">
        <Badge status={status} label={STATUS_LABEL[status]} />
      </td>
      <td className="px-5 py-2.5">
        {rt === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className={`font-mono text-[12.5px] ${responseTimeClass(rt)}`}>{rt}ms</span>
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
