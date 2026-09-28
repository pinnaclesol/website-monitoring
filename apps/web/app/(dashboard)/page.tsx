'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { hasPermission } from '@uptime/auth';
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
  Tooltip,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../lib/api-client';
import type { MonitorWithStatus, MonitoringSettings, MonitorListResponse, MonitorStats } from '../../lib/types';
import { stripProtocol, formatDuration, formatIntervalWords } from '../../lib/format';
import { MonitorRow } from './monitor-row';
import { MonitorModal } from './monitor-modal';
import { useSiteName } from './site-name-context';
import { PermissionGate } from './permission-gate';

const POLL_INTERVAL_MS = 15000;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

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
function ArrowRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function LayersIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="12 2 22 8.5 12 15 2 8.5 12 2" />
      <polyline points="2 15.5 12 22 22 15.5" />
      <polyline points="2 12 12 18.5 22 12" />
    </svg>
  );
}
function CheckCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="8 12.5 11 15.5 16 9" />
    </svg>
  );
}
function XCircleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
      <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
    </svg>
  );
}
function TimerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="10" y1="2" x2="14" y2="2" />
      <line x1="12" y1="6" x2="12" y2="3" />
      <circle cx="12" cy="14" r="8" />
      <polyline points="12 10 12 14 15 16" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="11.5" />
      <circle cx="12" cy="8" r="0.5" fill="currentColor" stroke="none" />
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
  const { data: session } = useSession();
  const permissions = session?.user.permissions;
  const canCreate = !!permissions && hasPermission(permissions, 'monitors:create');
  const canUpdate = !!permissions && hasPermission(permissions, 'monitors:update');
  const canDelete = !!permissions && hasPermission(permissions, 'monitors:delete');
  const [monitors, setMonitors] = useState<MonitorWithStatus[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [stats, setStats] = useState<MonitorStats | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState<MonitorWithStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MonitorWithStatus | null>(null);
  const toast = useToast();

  const [secondsToRefresh, setSecondsToRefresh] = useState(POLL_INTERVAL_MS / 1000);
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkIntervalSeconds, setCheckIntervalSeconds] = useState(60);

  useEffect(() => {
    // Fetched once, not on the monitors poll — this rarely changes and
    // isn't part of the live status data.
    apiFetch<MonitoringSettings>('settings/monitoring')
      .then((settings) => setCheckIntervalSeconds(settings.checkIntervalSeconds))
      .catch(() => {
        // Falls back to the 60s default already in state — not worth a toast.
      });
  }, []);

  // Debounced so typing a search term doesn't fire a request per keystroke —
  // search/status filtering happens server-side now (see `load` below), not
  // over a fully-loaded array, so every keystroke would otherwise be a real
  // round trip.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  // A changed search/filter/page-size invalidates whatever page you were on
  // — e.g. being on page 3 of "all" and then filtering to "down" (or
  // switching to a larger page size) shouldn't silently keep you on page 3
  // of a much shorter result set.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      // Two independent endpoints on purpose: this page's monitor rows
      // (server-side paginated — only ever one page's worth in the browser)
      // versus the dashboard-wide stat cards / incident banner, which must
      // reflect every monitor regardless of which page or filter is active.
      const [list, statsResult] = await Promise.all([
        apiFetch<MonitorListResponse>(`monitors?${params.toString()}`),
        apiFetch<MonitorStats>('monitors/stats'),
      ]);
      setMonitors(list.data);
      setTotal(list.total);
      setStats(statsResult);
    } catch {
      // Poll silently retries — a toast on every failed background poll would be noisy.
    } finally {
      setSecondsToRefresh(POLL_INTERVAL_MS / 1000);
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
    // A single 1s tick both drives the visible countdown and triggers the
    // actual re-fetch once it reaches zero — not two independent timers
    // (a fetch interval plus a separate display countdown), so a manual
    // refresh (which resets secondsToRefresh via load()'s own finally) stays
    // in sync with when the next real auto-fetch actually happens, instead
    // of a stale second timer firing on its own unrelated schedule. This is
    // the dashboard's own poll countdown — not a per-monitor "next check"
    // time, which apps/worker staggers independently per monitor (jitter)
    // and the dashboard has no way to know precisely.
    const tickInterval = setInterval(() => {
      setSecondsToRefresh((s) => {
        if (s <= 1) {
          load();
          return POLL_INTERVAL_MS / 1000;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tickInterval);
  }, [load]);

  async function manualRefresh() {
    setManualRefreshing(true);
    try {
      await load();
    } finally {
      setManualRefreshing(false);
    }
  }

  async function checkAll() {
    setCheckingAll(true);
    try {
      const result = await apiFetch<{ queued: number }>('monitors/check-all', { method: 'POST' });
      if (result.queued === 0) {
        toast({ type: 'info', title: 'No active monitors', message: 'Add or resume a monitor first.' });
      } else {
        toast({ type: 'info', title: 'Checks queued', message: `${result.queued} monitor(s) will be checked shortly` });
      }
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Could not queue checks', message: err instanceof Error ? err.message : undefined });
    } finally {
      setCheckingAll(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFiltering = debouncedSearch !== '' || statusFilter !== 'all';

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
    <PermissionGate permission="monitors:view">
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
            <Button variant="outline" size="sm" onClick={manualRefresh} disabled={manualRefreshing}>
              <span className={manualRefreshing ? 'animate-spin' : undefined}>
                <RefreshIcon />
              </span>
              {manualRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </>
        }
      >
        <Breadcrumb section={siteName} page="Dashboard" />
      </Topbar>
      <div className="flex-1 p-6">
        <IncidentBanner>
          {stats && stats.openIncidents > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <span className="font-semibold">
                  {stats.openIncidents} monitor{stats.openIncidents > 1 ? 's are' : ' is'} currently down.
                </span>{' '}
                <span className="text-red/85">
                  {stats.openIncidents > 1 ? 'They are' : 'It is'} not responding to health checks.
                </span>
              </div>
              <Button asChild variant="danger" size="sm" className="shrink-0">
                <a href="/incidents">
                  View incidents
                  <ArrowRightIcon />
                </a>
              </Button>
            </div>
          ) : null}
        </IncidentBanner>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<LayersIcon />}
            label="Total monitors"
            value={stats?.total ?? 0}
            sub="URLs being tracked"
            accent="blue"
          />
          <StatCard
            icon={<CheckCircleIcon />}
            label="Online"
            value={stats?.up ?? 0}
            accent="green"
            sub="Responding normally"
          />
          <StatCard
            icon={<XCircleIcon />}
            label="Down"
            value={stats?.down ?? 0}
            accent="red"
            pulse={!!stats && stats.down > 0}
            sub="Not responding"
          />
          <StatCard
            icon={<TimerIcon />}
            label="Longest outage"
            value={
              stats?.longestOpenIncident
                ? formatDuration(Date.now() - new Date(stats.longestOpenIncident.startedAt).getTime())
                : '—'
            }
            accent={stats?.longestOpenIncident ? 'red' : 'green'}
            pulse={!!stats?.longestOpenIncident}
            sub={
              stats?.longestOpenIncident
                ? stats.longestOpenIncident.label || stripProtocol(stats.longestOpenIncident.domain)
                : 'No active outages'
            }
          />
        </div>

        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Monitors</CardTitle>
              <CardDescription>
                Checks run every {formatIntervalWords(checkIntervalSeconds)} — showing the most recent 30 checks as
                bars, with up to 500 kept in history per monitor
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
              {canCreate ? (
                <Button onClick={() => setAddOpen(true)}>
                  <PlusIcon />
                  Add monitor
                </Button>
              ) : null}
            </div>
          </CardHeader>

          {canUpdate ? (
            <div className="flex items-center justify-end border-t border-border px-5 py-2.5">
              <Button variant="outline" size="sm" onClick={checkAll} disabled={checkingAll}>
                <RefreshIcon />
                {checkingAll ? 'Queuing…' : 'Check all'}
              </Button>
            </div>
          ) : null}

          {monitors === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : monitors.length === 0 ? (
            <EmptyState
              icon={<BareIcon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
              title={isFiltering ? 'No matches' : 'No monitors yet'}
              description={isFiltering ? 'Try a different search or filter' : 'Add a URL above to start tracking uptime'}
            />
          ) : (
            <>
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
                        <span className="inline-flex items-center gap-1">
                          Uptime (24h)
                          <Tooltip content="Percentage of time this monitor was up over the last 24 hours (or since it was added, if that was more recently)">
                            <InfoIcon />
                          </Tooltip>
                        </span>
                      </th>
                      <th className="w-20 px-5 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {monitors.map((monitor) => (
                      <MonitorRow
                        key={monitor.id}
                        monitor={monitor}
                        canUpdate={canUpdate}
                        canDelete={canDelete}
                        onChanged={load}
                        onEditRequested={setEditingMonitor}
                        onDeleteRequested={setDeleteTarget}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
                  </span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-7 w-[122px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size} per page
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="text-xs text-text-muted">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>

      {canCreate || canUpdate ? (
        <MonitorModal
          open={addOpen || editingMonitor !== null}
          onClose={() => {
            setAddOpen(false);
            setEditingMonitor(null);
          }}
          onSaved={load}
          editingMonitor={editingMonitor}
          monitors={monitors ?? []}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Remove monitor?"
        description={`Remove "${deleteTarget?.label || (deleteTarget ? stripProtocol(deleteTarget.domain) : '')}"? All check history will be deleted.`}
        confirmLabel="Remove"
      />
    </PermissionGate>
  );
}
