import { ProxyAgent } from 'undici';

/**
 * Smartproxy picks the exit country from a suffix on the username
 * (`<user>_area-US`), same host/port for every country. SMARTPROXY_USERNAME may
 * be stored with or without such a suffix — it's stripped and re-applied per region.
 */
const AREA_SUFFIX = /_area-[a-z]{2}$/i;

const agents = new Map<string, ProxyAgent>();

/** Read per call (not at import) so the root .env loaded in main.ts is always seen. */
export function isProxyEnabled(): boolean {
  const { SMARTPROXY_ENABLED, SMARTPROXY_HOST, SMARTPROXY_PORT, SMARTPROXY_USERNAME, SMARTPROXY_PASSWORD } = process.env;
  return (
    SMARTPROXY_ENABLED === 'true' &&
    !!SMARTPROXY_HOST &&
    !!SMARTPROXY_PORT &&
    !!SMARTPROXY_USERNAME &&
    !!SMARTPROXY_PASSWORD
  );
}

/** One pooled agent per country, created on first use. Credentials never leave this process. */
export function getProxyAgent(region: string): ProxyAgent {
  const code = region.toUpperCase();
  const cached = agents.get(code);
  if (cached) return cached;

  const { SMARTPROXY_HOST, SMARTPROXY_PORT, SMARTPROXY_USERNAME, SMARTPROXY_PASSWORD } = process.env;
  const username = `${(SMARTPROXY_USERNAME as string).replace(AREA_SUFFIX, '')}_area-${code}`;
  const agent = new ProxyAgent({
    uri: `http://${SMARTPROXY_HOST}:${SMARTPROXY_PORT}`,
    token: `Basic ${Buffer.from(`${username}:${SMARTPROXY_PASSWORD}`).toString('base64')}`,
  });
  agents.set(code, agent);
  return agent;
}

export async function closeProxyAgents(): Promise<void> {
  await Promise.all([...agents.values()].map((a) => a.close().catch(() => undefined)));
  agents.clear();
}
