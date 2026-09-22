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
  Button,
  IncidentBanner,
  EmptyState,
  ConfirmDialog,
  useToast,
} from '@uptime/ui';
import { apiFetch } from '../../lib/api-client';
import { monitorStatus, type SiteWithStatus } from '../../lib/types';
import { stripProtocol } from '../../lib/format';
import { MonitorRow } from './monitor-row';
import { AddMonitorModal } from './add-monitor-modal';

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

export default function DashboardPage() {
  const [sites, setSites] = useState<SiteWithStatus[] | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SiteWithStatus | null>(null);
  const toast = useToast();

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<SiteWithStatus[]>('sites');
      setSites(data);
    } catch {
      // Poll silently retries — a toast on every failed background poll would be noisy.
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const filtered = useMemo(() => {
    if (!sites) return [];
    return sites.filter((site) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q || site.domain.toLowerCase().includes(q) || (site.label ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'all' || monitorStatus(site) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [sites, search, statusFilter]);

  const stats = useMemo(() => {
    const enabled = (sites ?? []).filter((s) => !s.isPaused);
    const up = enabled.filter((s) => s.latestCheck?.isUp).length;
    const down = enabled.filter((s) => s.latestCheck && !s.latestCheck.isUp).length;
    const responseTimes = enabled.map((s) => s.latestCheck?.responseTimeMs).filter((v): v is number => v != null);
    const avg = responseTimes.length
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : null;
    return { total: sites?.length ?? 0, up, down, avg };
  }, [sites]);

  const downSites = (sites ?? []).filter((s) => s.hasOpenIncident);

  async function handleDelete() {
    if (!deleteTarget) return;
    const label = deleteTarget.label || stripProtocol(deleteTarget.domain);
    try {
      await apiFetch(`sites/${deleteTarget.id}`, { method: 'DELETE' });
      toast({ type: 'info', title: 'Removed', message: `Stopped monitoring ${label}` });
      setDeleteTarget(null);
      load();
    } catch (err) {
      toast({ type: 'error', title: 'Could not remove monitor', message: err instanceof Error ? err.message : undefined });
    }
  }

  return (
    <>
      <Topbar>
        <Breadcrumb section="Uptime Monitor" page="Dashboard" />
      </Topbar>
      <div className="flex-1 p-6">
        <IncidentBanner>
          {downSites.length > 0 ? (
            <>
              <AlertCircleIcon />
              <span>
                {downSites.length} site{downSites.length > 1 ? 's are' : ' is'} currently down — see the{' '}
                <a href="/incidents" className="underline">
                  Incidents
                </a>{' '}
                page for details
              </span>
            </>
          ) : null}
        </IncidentBanner>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<TargetIcon />} label="Total monitors" value={stats.total} sub="URLs being tracked" />
          <StatCard
            icon={<BareIcon d="M22 11.08V12a10 10 0 11-5.93-9.14" />}
            label="Online"
            value={stats.up}
            valueColor="green"
            sub="Responding normally"
          />
          <StatCard
            icon={<BareIcon d="M15 9l-6 6M9 9l6 6" />}
            label="Down"
            value={stats.down}
            valueColor="red"
            sub="Not responding"
          />
          <StatCard
            icon={<BareIcon d="M22 12h-4l-3 9L9 3l-3 9H2" />}
            label="Avg response"
            value={stats.avg === null ? '—' : `${stats.avg}ms`}
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
              <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[132px]">
                <option value="all">All statuses</option>
                <option value="up">Online only</option>
                <option value="down">Down only</option>
                <option value="paused">Paused only</option>
              </Select>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <PlusIcon />
                Add monitor
              </Button>
            </div>
          </CardHeader>

          {sites === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<BareIcon d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />}
              title={sites.length === 0 ? 'No monitors yet' : 'No matches'}
              description={
                sites.length === 0
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
                  {filtered.map((site) => (
                    <MonitorRow key={site.id} site={site} onChanged={load} onDeleteRequested={setDeleteTarget} />
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
