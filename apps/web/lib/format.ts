export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return '<1m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

/** Response-time color thresholds matching the design: <200ms fast, <800ms medium, else slow. */
export function responseTimeClass(ms: number): string {
  if (ms < 200) return 'text-green';
  if (ms < 800) return 'text-yellow';
  return 'text-red';
}

export function uptimeColorClass(uptime: number | null): string {
  if (uptime === null) return 'text-text-subtle';
  if (uptime >= 99) return 'text-green';
  if (uptime >= 95) return 'text-yellow';
  return 'text-red';
}

export function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, '');
}
