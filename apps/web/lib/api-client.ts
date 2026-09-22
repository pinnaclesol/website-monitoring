/**
 * Thin fetch wrapper for calling THIS APP'S OWN `/api/*` proxy (never
 * `apps/api` directly from the browser — see `app/api/[...path]/route.ts`).
 * Throws on a non-2xx response with the upstream error message when present.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/${path.replace(/^\/+/, '')}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}
