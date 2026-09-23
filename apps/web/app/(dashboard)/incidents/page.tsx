'use client';

import { useEffect, useState } from 'react';
import { Topbar, Breadcrumb, Card, CardHeader, CardTitle, CardDescription, Badge, EmptyState } from '@uptime/ui';
import { apiFetch } from '../../../lib/api-client';
import { stripProtocol } from '../../../lib/format';
import type { IncidentWithMonitor } from '../../../lib/types';
import { useSiteName } from '../site-name-context';

const POLL_INTERVAL_MS = 15000;

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<IncidentWithMonitor[]>('incidents');
        setIncidents(data);
      } catch {
        // Poll silently retries.
      }
    }
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <Topbar>
        <Breadcrumb section={siteName} page="Incidents" />
      </Topbar>
      <div className="flex-1 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Incident log</CardTitle>
            <CardDescription>Downtime events recorded across all monitors</CardDescription>
          </CardHeader>

          {incidents === null ? (
            <div className="px-6 py-11 text-center text-sm text-text-muted">Loading…</div>
          ) : incidents.length === 0 ? (
            <EmptyState icon={<CheckIcon />} title="No incidents" description="All monitors have been healthy" />
          ) : (
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
                        <span className="font-mono text-xs text-text-muted">{stripProtocol(incident.monitor.domain)}</span>
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
          )}
        </Card>
      </div>
    </>
  );
}
