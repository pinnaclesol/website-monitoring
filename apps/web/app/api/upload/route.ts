import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { hasPermission } from '@uptime/auth';
import { authOptions } from '../../../lib/auth';

/**
 * Local image upload for branding assets (favicon/logo) — the one apps/web
 * route NOT proxied to apps/api. A static segment (`api/upload`) is
 * resolved by Next.js before the catch-all proxy (`api/[...path]`), so this
 * coexists safely without touching that route.
 *
 * Files land on THIS app's own local disk under `public/uploads/`, which
 * Next.js serves automatically at `/uploads/<file>` — no separate serving
 * route needed. This is runtime-written state on the apps/web VPS: a deploy
 * that does a clean checkout/rebuild must preserve this directory (see
 * CLAUDE.md) or uploaded images are lost on redeploy.
 */

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
const MAX_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
};

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPermission(session.user.role, 'settings:update')) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get('file');
  const previousUrl = formData.get('previousUrl');

  if (!(file instanceof File)) {
    return NextResponse.json({ message: 'No file provided' }, { status: 400 });
  }

  const extension = ALLOWED_TYPES[file.type];
  if (!extension) {
    return NextResponse.json({ message: 'Unsupported image type' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ message: 'Image must be 2MB or smaller' }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const filename = `${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), bytes);

  if (typeof previousUrl === 'string') {
    await deleteIfOwnUpload(previousUrl);
  }

  return NextResponse.json({ url: `/uploads/${filename}` });
}

/** Best-effort cleanup — never lets a delete failure fail the upload response. */
async function deleteIfOwnUpload(url: string): Promise<void> {
  if (!url.startsWith('/uploads/')) return; // external/legacy URL from before this feature — leave it alone
  const filename = url.slice('/uploads/'.length);
  if (!filename || filename.includes('/') || filename.includes('..')) return;
  try {
    await unlink(path.join(UPLOAD_DIR, filename));
  } catch {
    // Already gone, or a permissions issue — not worth failing the request over.
  }
}
