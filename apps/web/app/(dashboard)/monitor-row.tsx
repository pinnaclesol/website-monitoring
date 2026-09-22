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
import { monitorStatus, type SiteWithStatus } from '../../lib/types';

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

export function MonitorRow({
  site,
  onChanged,
  onDeleteRequested,
}: {
  site: SiteWithStatus;
  onChanged: () => void;
  onDeleteRequested: (site: SiteWithStatus) => void;
}) {
  const toast = useToast();
  const status = monitorStatus(site);
  const urlShort = stripProtocol(site.domain);
  const rt = site.latestCheck?.responseTimeMs ?? null;

  async function togglePause(nextEnabled: boolean) {
    try {
      await apiFetch(`sites/${site.id}/${nextEnabled ? 'resume' : 'pause'}`, { method: 'POST' });
      toast({
        type: 'info',
        title: nextEnabled ? 'Monitoring resumed' : 'Monitoring paused',
        message: site.label || urlShort,
      });
      onChanged();
    } catch (err) {
      toast({ type: 'error', title: 'Could not update monitor', message: err instanceof Error ? err.message : undefined });
    }
  }

  async function checkNow() {
    try {
      await apiFetch(`sites/${site.id}/check-now`, { method: 'POST' });
      toast({ type: 'info', title: 'Check queued', message: `${site.label || urlShort} will be checked shortly` });
      onChanged();
    } catch (err) {
      toast({ type: 'error', title: 'Could not queue check', message: err instanceof Error ? err.message : undefined });
    }
  }

  function copyUrl() {
    navigator.clipboard
      .writeText(`https://${site.domain}`)
      .then(() => toast({ type: 'success', title: 'Copied', message: `https://${site.domain}` }));
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-bg-secondary">
      <td className="px-5 py-2.5">
        <Toggle
          checked={!site.isPaused}
          onCheckedChange={togglePause}
          aria-label={site.isPaused ? 'Resume monitoring' : 'Pause monitoring'}
        />
      </td>
      <td className="px-5 py-2.5">
        <div className="text-[13.5px] font-medium text-text">{site.label || urlShort}</div>
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
        <span className="text-xs text-text-muted">{timeAgo(site.latestCheck?.timestamp)}</span>
      </td>
      <td className="px-5 py-2.5">
        <HistoryBars history={padHistory(site.history)} />
      </td>
      <td className="px-5 py-2.5">
        <span className={`font-mono text-[12.5px] font-medium ${uptimeColorClass(site.uptime24h)}`}>
          {site.uptime24h === null ? '—' : `${site.uptime24h.toFixed(1)}%`}
        </span>
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="sm" className="p-1.5" title="Check now" onClick={checkNow}>
            <CheckNowIcon />
          </Button>
          <Dropdown>
            <DropdownTrigger asChild>
              <Button variant="ghost" size="sm" className="p-1.5">
                <DotsIcon />
              </Button>
            </DropdownTrigger>
            <DropdownContent>
              <DropdownItem onClick={copyUrl}>Copy URL</DropdownItem>
              <DropdownItem onClick={() => window.open(`https://${site.domain}`, '_blank', 'noopener')}>
                Open site
              </DropdownItem>
              <DropdownSeparator />
              <DropdownItem danger onClick={() => onDeleteRequested(site)}>
                Remove
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </td>
    </tr>
  );
}
