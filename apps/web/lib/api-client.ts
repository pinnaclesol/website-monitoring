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

  // Defense in depth: a 2xx response with a genuinely empty body (0 bytes,
  // not the 4-byte JSON text "null") shouldn't crash the caller with
  // "Unexpected end of JSON input" — that's a backend bug (a NestJS
  // controller returning a bare `null`/`undefined`, which Nest's default
  // response handling turns into an empty body instead of writing "null"),
  // fixed at the source where it was found (settings/signal-config), but a
  // route re-introducing it shouldn't take the whole page down.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
