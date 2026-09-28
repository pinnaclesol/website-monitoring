'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Topbar,
  Breadcrumb,
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
  Badge,
  EmptyState,
} from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import { stripProtocol } from '../../../lib/format';
import type { IncidentWithMonitor, IncidentListResponse } from '../../../lib/types';
import { useSiteName } from '../site-name-context';
import { PermissionGate } from '../permission-gate';

const POLL_INTERVAL_MS = 15000;
const DEFAULT_PAGE_SIZE = 20;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
const SEARCH_DEBOUNCE_MS = 300;

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
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

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDurationBetween(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const minutes = Math.max(1, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (hours < 24) return remMinutes ? `${hours}h ${remMinutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export default function IncidentsPage() {
  const siteName = useSiteName();
  const [incidents, setIncidents] = useState<IncidentWithMonitor[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounced so typing a search term doesn't fire a request per keystroke
  // — search/status filtering happens server-side (see `load` below).
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  // A changed search/filter/page-size invalidates whatever page you were on.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, pageSize]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter !== 'all') params.set('status', statusFilter);

      const result = await apiFetch<IncidentListResponse>(`incidents?${params.toString()}`);
      setIncidents(result.data);
      setTotal(result.total);
    } catch {
      // Poll silently retries.
    }
  }, [page, pageSize, debouncedSearch, statusFilter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const isFiltering = debouncedSearch !== '' || statusFilter !== 'all';

  return (
    <PermissionGate permission="incidents:view">
      <Topbar>
        <Breadcrumb section={siteName} page="Incidents" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card>
          <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Incident log</CardTitle>
              <CardDescription>Downtime events recorded across all monitors</CardDescription>
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
                  <SelectItem value="open">Ongoing only</SelectItem>
                  <SelectItem value="recovered">Recovered only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>

          {incidents === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : incidents.length === 0 ? (
            <EmptyState
              icon={<CheckIcon />}
              title={isFiltering ? 'No matches' : 'No incidents'}
              description={isFiltering ? 'Try a different search or filter' : 'All monitors have been healthy'}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-bg-secondary">
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Monitor</th>
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">URL</th>
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Status</th>
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Started</th>
                      <th className="px-5 py-2.5 text-left text-[11.5px] font-medium text-text-muted">Duration</th>
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => (
                      <tr key={incident.id} className="border-b border-border last:border-b-0 hover:bg-bg-secondary">
                        <td className="px-5 py-2.5">
                          <span className="text-[13.5px] font-medium text-text">
                            {incident.monitor.label || stripProtocol(incident.monitor.domain)}
                          </span>
                        </td>
                        <td className="px-5 py-2.5">
                          <a
                            href={`https://${incident.monitor.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open https://${incident.monitor.domain} in a new tab`}
                            className="inline-flex items-center gap-1 font-mono text-xs text-text-muted hover:text-accent hover:underline"
                          >
                            {stripProtocol(incident.monitor.domain)}
                            <ExternalLinkIcon />
                          </a>
                        </td>
                        <td className="px-5 py-2.5">
                          {incident.endedAt ? (
                            <Badge status="up" label="Recovered" />
                          ) : (
                            <Badge status="down" label="Ongoing" />
                          )}
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="text-xs text-text-muted">{formatTimestamp(incident.startedAt)}</span>
                        </td>
                        <td className="px-5 py-2.5">
                          <span className="font-mono text-[12.5px] text-text-muted">
                            {formatDurationBetween(incident.startedAt, incident.endedAt)}
                          </span>
                        </td>
                      </tr>
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
    </PermissionGate>
  );
}
