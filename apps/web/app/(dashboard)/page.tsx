'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Topbar,
  Breadcrumb,
  StatCard,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  IncidentBanner,
  EmptyState,
  ConfirmDialog,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../lib/api-client';
import { monitorStatus, type MonitorWithStatus } from '../../lib/types';
import { stripProtocol } from '../../lib/format';
import { MonitorRow } from './monitor-row';
import { AddMonitorModal } from './add-monitor-modal';
import { useSiteName } from './site-name-context';

const POLL_INTERVAL_MS = 8000;

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}
function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
function BareIcon({ d }: { d: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
function AlertCircleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
function TargetIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M23 4v6h-6" />
      <path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  );
}

export default function DashboardPage() {
  const siteName = useSiteName();
  const [monitors, setMonitors] = useState<MonitorWithStatus[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MonitorWithStatus | null>(null);
  const toast = useToast();

  const [secondsToRefresh, setSecondsToRefresh] = useState(POLL_INTERVAL_MS / 1000);
  const [checkingAll, setCheckingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<MonitorWithStatus[]>('monitors');
      setMonitors(data);
    } catch {
      // Poll silently retries — a toast on every failed background poll would be noisy.
    } finally {
      setSecondsToRefresh(POLL_INTERVAL_MS / 1000);
    }
  }, []);

  useEffect(() => {
    load();
    const refreshInterval = setInterval(load, POLL_INTERVAL_MS);
    // A real countdown to the dashboard's own next auto-refresh — not a
    // per-monitor "next check" time, which apps/worker staggers
    // independently per monitor (jitter) and the dashboard has no way to
    // know precisely.
    const tickInterval = setInterval(() => {
      setSecondsToRefresh((s) => (s <= 1 ? POLL_INTERVAL_MS / 1000 : s - 1));
    }, 1000);
    return () => {
      clearInterval(refreshInterval);
      clearInterval(tickInterval);
    };
  }, [load]);

  async function checkAll() {
    const targets = (monitors ?? []).filter((m) => !m.isPaused);
    if (targets.length === 0) {
      toast({ type: 'info', title: 'No active monitors', message: 'Add or resume a monitor first.' });
      return;
    }
    setCheckingAll(true);
    try {
      await Promise.all(targets.map((m) => apiFetch(`monitors/${m.id}/check-now`, { method: 'POST' })));
      toast({ type: 'info', title: 'Checks queued', message: `${targets.length} monitor(s) will be checked shortly` });
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Could not queue checks', message: err instanceof Error ? err.message : undefined });
    } finally {
      setCheckingAll(false);
    }
  }

  const filtered = useMemo(() => {
    if (!monitors) return [];
    return monitors.filter((monitor) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q || monitor.domain.toLowerCase().includes(q) || (monitor.label ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || monitorStatus(monitor) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [monitors, search, statusFilter]);

  const stats = useMemo(() => {
    const enabled = (monitors ?? []).filter((m) => !m.isPaused);
    const up = enabled.filter((m) => m.latestCheck?.isUp).length;
    const down = enabled.filter((m) => m.latestCheck && !m.latestCheck.isUp).length;
    const responseTimes = enabled.map((m) => m.latestCheck?.responseTimeMs).filter((v): v is number => v != null);
    const avg = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;
    return { total: monitors?.length ?? 0, up, down, avg };
  }, [monitors]);

  const downMonitors = (monitors ?? []).filter((m) => m.hasOpenIncident);

  async function handleDelete() {
    if (!deleteTarget) return;
    const label = deleteTarget.label || stripProtocol(deleteTarget.domain);
    try {
      await apiFetch(`monitors/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ type: 'info', title: 'Removed', message: `Stopped monitoring ${label}` });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove monitor', message: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <>
      <Topbar
        actions={
          <>
            <span className="flex items-center gap-1.5 text-xs text-text-subtle">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-green opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-green" />
              </span>
              Refreshing in <span className="font-mono font-medium text-text-muted">{secondsToRefresh}s</span>
            </span>
            <Button variant="outline" size="sm" onClick={checkAll} disabled={checkingAll}>
              <RefreshIcon />
              {checkingAll ? 'Queuing…' : 'Check all'}
            </Button>
          </>
        }
      >
        <Breadcrumb section={siteName} page="Dashboard" />
      </Topbar>
      <div className="flex-1 p-6">
        <IncidentBanner>
          {downMonitors.length > 0 ? (
            <>
              <AlertCircleIcon />
              <span>
                {downMonitors.length} monitor{downMonitors.length > 1 ? 's are' : ' is'} currently down — see the{' '}
                <a href="/incidents" className="underline">
                  Incidents
                </a>{' '}
                page for details
              </span>
            </>
          ) : null}
        </IncidentBanner>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<TargetIcon />}
            label="Total monitors"
            value={stats.total}
            sub="URLs being tracked"
            accent="blue"
          />
          <StatCard
            icon={<BareIcon d="M22 11.08V12a10 10 0 11-5.93-9.14" />}
            label="Online"
            value={stats.up}
            accent="green"
            sub="Responding normally"
          />
          <StatCard
            icon={<BareIcon d="M15 9l-6 6M9 9l6 6" />}
            label="Down"
            value={stats.down}
            accent="red"
            sub="Not responding"
          />
          <StatCard
            icon={<BareIcon d="M22 12h-4l-3 9L9 3l-3 9H2" />}
            label="Avg response"
            value={stats.avg === null ? '—' : `${stats.avg}ms`}
            accent="yellow"
            sub="Across all monitors"
          />
        </div>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Monitors</CardTitle>
              <CardDescription>
                Checked every 60s — last 30 checks shown as bars, 100 stored per monitor
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-subtle">
                  <SearchIcon />
                </span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="w-[180px] pl-8"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="up">Online only</SelectItem>
                  <SelectItem value="down">Down only</SelectItem>
                  <SelectItem value="paused">Paused only</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setAddOpen(true)}>
                <PlusIcon />
                Add monitor
              </Button>
            </div>
          </CardHeader>

          {monitors === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BareIcon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
              title={monitors.length === 0 ? 'No monitors yet' : 'No matches'}
              description={
                monitors.length === 0
                  ? 'Add a URL above to start tracking uptime'
                  : 'Try a different search or filter'
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border bg-bg-secondary">
                    <th className="w-11 px-5 py-2.5" />
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Monitor</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Status</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Response</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Last checked</th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">
                      Last 30 checks
                    </th>
                    <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">
                      Uptime (24h)
                    </th>
                    <th className="w-20 px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((monitor) => (
                    <MonitorRow
                      key={monitor.id}
                      monitor={monitor}
                      onChanged={load}
                      onDeleteRequested={setDeleteTarget}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <AddMonitorModal open={addOpen} onClose={() => setAddOpen(false)} onAdded={load} />

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove monitor?"
        description={`Remove "${deleteTarget?.label || (deleteTarget ? stripProtocol(deleteTarget.domain) : '')}"? All check history will be deleted.`}
        confirmLabel="Remove"
      />
    </>
  );
}
