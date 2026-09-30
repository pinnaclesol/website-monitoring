import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../../../lib/auth';

const SIGNAL_BRIDGE_URL = (
  process.env.SIGNAL_REST_API_URL ||
  process.env.SIGNAL_API_URL ||
  'http://127.0.0.1:8080'
).replace(/\/+$/, '');

async function handleRequest(request: NextRequest, pathSegments: string[]) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const processedSegments = pathSegments.map((segment) => encodeURIComponent(segment));
  const path = processedSegments.join('/');
  const searchParams = request.nextUrl.searchParams.toString();
  const url = `${SIGNAL_BRIDGE_URL}/${path}${searchParams ? `?${searchParams}` : ''}`;

  try {
    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const body = hasBody ? await request.arrayBuffer() : undefined;

    const headers: Record<string, string> = {};
    const contentType = request.headers.get('content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: 'no-store',
    });

    if (upstream.status === 204) {
      return new NextResponse(null, { status: 204 });
    }

    const upstreamContentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const data = await upstream.arrayBuffer();

    return new NextResponse(data, {
      status: upstream.status,
      headers: {
        'Content-Type': upstreamContentType,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to communicate with Signal Bridge', details: error.message },
      { status: 502 }
    );
  }
}

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).path);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).path);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).path);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return handleRequest(req, (await params).path);
}
