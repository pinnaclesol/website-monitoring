import { fetch, type Dispatcher } from 'undici';

/** Redirect hops followed before a chain is reported as broken. */
const MAX_REDIRECTS = 10;

/**
 * Look like a normal visitor — a bare Node `fetch` sends `user-agent: node`,
 * which many sites/CDNs answer with 403 (reported as a false "down").
 */
const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

export type CheckErrorType =
  | 'dns'
  | 'timeout'
  | 'tls'
  | 'connection_refused'
  | 'connection_reset'
  | 'redirect_loop'
  | 'too_many_redirects'
  | 'http_status'
  /** The proxy itself failed (auth/tunnel) — says nothing about the site. */
  | 'proxy'
  | 'unknown';

export interface CheckResult {
  isUp: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
  errorType: CheckErrorType | null;
  finalUrl: string | null;
  redirectCount: number;
}

/** Outcome of one request chain (all redirects) against a single URL. */
class CheckFailure extends Error {
  constructor(
    message: string,
    readonly errorType: CheckErrorType,
    readonly finalUrl: string,
    readonly redirectCount: number,
  ) {
    super(message);
  }
}

/** Maps a low-level fetch/undici error to a category and a readable message. */
function classifyError(err: unknown, viaProxy: boolean): { errorType: CheckErrorType; message: string } {
  const cause = (err as { cause?: { code?: string; message?: string; name?: string; errors?: Array<{ code?: string }> } })?.cause;
  // A host with both IPv4 and IPv6 addresses fails as an AggregateError whose
  // top-level `code` is empty — the real code is on the first inner error.
  const code = cause?.code || cause?.errors?.[0]?.code || (err as { code?: string })?.code || '';
  const name = (err as { name?: string })?.name ?? '';

  if (name === 'AbortError' || name === 'TimeoutError' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    return { errorType: 'timeout', message: 'Request timed out' };
  }
  // undici surfaces a refused proxy login (407) or a failed CONNECT tunnel as
  // an aborted request — through a proxy that is the proxy's fault, not the site's.
  if (viaProxy && (cause?.name === 'RequestAbortedError' || /Request was cancelled|Proxy response|tunnel/i.test(cause?.message ?? ''))) {
    return { errorType: 'proxy', message: 'Proxy connection failed' };
  }
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    return { errorType: 'dns', message: 'DNS lookup failed — domain not found' };
  }
  if (code === 'ECONNREFUSED') {
    return { errorType: 'connection_refused', message: 'Connection refused' };
  }
  if (code === 'ECONNRESET' || code === 'UND_ERR_SOCKET') {
    return { errorType: 'connection_reset', message: 'Connection reset by the server' };
  }
  if (/^(CERT_|ERR_TLS|ERR_SSL|DEPTH_ZERO|SELF_SIGNED|UNABLE_TO_VERIFY|HOSTNAME_MISMATCH)/.test(code) || /certificate|ssl|tls/i.test(cause?.message ?? '')) {
    return { errorType: 'tls', message: `TLS/certificate error${code ? ` (${code})` : ''}` };
  }
  return { errorType: 'unknown', message: err instanceof Error ? err.message : 'Unknown error' };
}

/**
 * Checks `https://<domain>` first; only if that fails at the connection/TLS
 * level (not a timeout or DNS failure, which http would hit too) does it
 * retry once over plain `http://`, for sites that don't serve HTTPS at all.
 * Pass a `dispatcher` (an undici ProxyAgent) to exit from another country.
 * Never throws — failures are captured into the result.
 */
export async function runHttpCheck(domain: string, timeoutMs: number, dispatcher?: Dispatcher): Promise<CheckResult> {
  const startedAt = Date.now();

  try {
    return await requestChain(`https://${domain}`, timeoutMs, startedAt, dispatcher);
  } catch (httpsErr) {
    const failure = httpsErr as CheckFailure;
    const canTryHttp = ['tls', 'connection_refused', 'connection_reset'].includes(failure.errorType);
    if (canTryHttp) {
      try {
        return await requestChain(`http://${domain}`, timeoutMs, Date.now(), dispatcher);
      } catch {
        // Report the original HTTPS failure — it's the one the user cares about.
      }
    }
    return {
      isUp: false,
      statusCode: null,
      responseTimeMs: Date.now() - startedAt,
      error: failure.message,
      errorType: failure.errorType,
      finalUrl: failure.finalUrl,
      redirectCount: failure.redirectCount,
    };
  }
}

/**
 * One request plus its whole redirect chain, followed manually so we can
 * count hops, record the final URL, and catch loops. The timeout covers the
 * entire chain. Throws `CheckFailure` on any transport-level problem.
 */
async function requestChain(
  startUrl: string,
  timeoutMs: number,
  startedAt: number,
  dispatcher?: Dispatcher,
): Promise<CheckResult> {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
  const visited = new Set<string>();
  let currentUrl = startUrl;
  let redirectCount = 0;

  try {
    for (;;) {
      visited.add(currentUrl);
      let response: Awaited<ReturnType<typeof fetch>>;
      try {
        response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: 'manual',
          headers: BROWSER_HEADERS,
          dispatcher,
        });
      } catch (err) {
        const { errorType, message } = classifyError(err, !!dispatcher);
        throw new CheckFailure(message, errorType, currentUrl, redirectCount);
      }
      // We only need the status line — free the socket instead of buffering the body.
      void response.body?.cancel().catch(() => undefined);

      const location = response.headers.get('location');
      const isRedirect = response.status >= 300 && response.status < 400 && location;
      if (isRedirect) {
        const nextUrl = new URL(location, currentUrl).toString();
        redirectCount++;
        if (visited.has(nextUrl)) {
          throw new CheckFailure('Redirect loop detected', 'redirect_loop', nextUrl, redirectCount);
        }
        if (redirectCount > MAX_REDIRECTS) {
          throw new CheckFailure(`Too many redirects (more than ${MAX_REDIRECTS})`, 'too_many_redirects', nextUrl, redirectCount);
        }
        currentUrl = nextUrl;
        continue;
      }

      // 2xx/3xx counts as up; 4xx/5xx counts as down — the site
      // responded, but should still be flagged as an outage.
      const isUp = response.status >= 200 && response.status < 400;
      return {
        isUp,
        statusCode: response.status,
        responseTimeMs: Date.now() - startedAt,
        error: isUp ? null : `Non-success status ${response.status}`,
        errorType: isUp ? null : 'http_status',
        finalUrl: currentUrl,
        redirectCount,
      };
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}
