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

/**
 * Response times render as ms only under 1s — past that, a raw "10001ms"
 * takes longer to parse than "10s". Scales all the way to hours since a
 * badly hung request can technically report one, even though in practice
 * checks time out well before then.
 */
export function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}min`;
  return `${(ms / 3600000).toFixed(1)}hr`;
}

/**
 * Full-word interval phrasing for the monitors card's description sentence
 * ("Checks run every 1 hour") — the monitoring-interval setting is stored
 * and validated in raw seconds (30–3600), but "every 3600s" reads like a
 * config file, not a sentence a non-technical dashboard viewer would parse
 * at a glance.
 */
export function formatIntervalWords(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? '' : 's'}`;
  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }
  const hours = Math.round(seconds / 3600);
  return `${hours} hour${hours === 1 ? '' : 's'}`;
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
