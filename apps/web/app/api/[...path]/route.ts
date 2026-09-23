import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../lib/auth';

/**
 * Single catch-all proxy: every apps/web data need goes through here to
 * apps/api, per CLAUDE.md — apps/web never talks to Postgres/Redis directly
 * and never exposes INTERNAL_API_KEY to the browser (it's only ever added
 * here, server-side). One handler for every resource (Sites/Checks/
 * Incidents/Settings) instead of a hand-written route file per resource —
 * apps/api already owns the real routing/validation, this just forwards.
 *
 * Session-gated: every proxied call requires an authenticated NextAuth
 * session, independent of apps/api's own INTERNAL_API_KEY guard — otherwise
 * this route would be an unauthenticated back door into apps/api from
 * anyone who can reach apps/web. Forwards `x-internal-api-key` (proves the
 * call came from this trusted proxy) and `x-user-id` (identifies which user
 * is calling, so apps/api's permission guard can enforce role-based access
 * server-side — the real security boundary; anything apps/web does to
 * hide/disable controls client-side is just a UX nicety on top of this).
 */
async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const apiUrl = process.env.API_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  if (!apiUrl || !internalApiKey) {
    return NextResponse.json({ message: 'API_URL/INTERNAL_API_KEY not configured' }, { status: 500 });
  }

  const targetUrl = `${apiUrl.replace(/\/+$/, '')}/api/${path.join('/')}${req.nextUrl.search}`;

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE';
  const body = hasBody ? await req.text() : undefined;

  const upstream = await fetch(targetUrl, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      'x-internal-api-key': internalApiKey,
      'x-user-id': session.user.id,
    },
    body: body || undefined,
    cache: 'no-store',
  });

  const responseText = await upstream.text();
  return new NextResponse(responseText || null, {
    status: upstream.status,
    headers: { 'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json' },
  });
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
