import * as path from 'path';
import * as dotenv from 'dotenv';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createAlertDispatchQueue, createCleanupQueue, createSiteChecksQueue } from '@uptime/queue';
import { AppModule } from './app.module';

const BULL_BOARD_PATH = '/admin/queues';

/**
 * HTTP Basic Auth gate for Bull Board only — applied as middleware on a
 * single path (`app.use(BULL_BOARD_PATH, ...)`), never as a global
 * guard/middleware, so `GET /health` stays public. Fails closed: if
 * BULL_BOARD_USER/PASS aren't configured, Bull Board is unreachable rather
 * than open. Credentials are compared in-memory only and are never logged.
 *
 * Typed loosely (no `express` type import) since `@types/express` isn't a
 * pinned workspace dependency — this repo only depends on `express`
 * transitively via `@nestjs/platform-express`/`@bull-board/express`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function bullBoardBasicAuth(req: any, res: any, next: any): void {
  const user = process.env.BULL_BOARD_USER;
  const pass = process.env.BULL_BOARD_PASS;

  if (!user || !pass) {
    res.status(503).send('Bull Board is not configured');
    return;
  }

  const header: string = req.headers?.authorization ?? '';
  const [scheme, encoded] = header.split(' ');

  if (scheme === 'Basic' && encoded) {
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    const separatorIndex = decoded.indexOf(':');
    const reqUser = decoded.slice(0, separatorIndex);
    const reqPass = decoded.slice(separatorIndex + 1);

    if (reqUser === user && reqPass === pass) {
      next();
      return;
    }
  }

  res.set('WWW-Authenticate', 'Basic realm="Bull Board"');
  res.status(401).send('Authentication required');
}

async function bootstrap(): Promise<void> {
  // This workspace uses ONE root .env for every app (not a per-app .env) —
  // see CLAUDE.md's Environment Setup section. Must run before
  // NestFactory.create instantiates ChecksService/CleanupService/AlertsService
  // (their @uptime/queue field initializers read REDIS_URL) and before the
  // createXQueue() calls below (BULL_BOARD_USER/PASS, REDIS_URL).
  // `../../../.env` resolves to the repo root from both this file's dev
  // location (apps/worker/src) and the webpack-bundled prod output
  // (dist/apps/worker) — both are three directories deep from the repo root.
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Run OnModuleDestroy hooks (ChecksService/CleanupService/AlertsService
  // close their BullMQ Workers there) on process shutdown signals.
  app.enableShutdownHooks();

  // Bull Board — read-only observability for all three queues. These Queue
  // instances are only used for the dashboard UI (read-only), share the one
  // Redis connection via @uptime/queue's factories, and are separate from
  // the consumer Workers registered by ChecksModule/CleanupModule/AlertsModule.
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BULL_BOARD_PATH);

  createBullBoard({
    queues: [
      new BullMQAdapter(createSiteChecksQueue()),
      new BullMQAdapter(createAlertDispatchQueue()),
      new BullMQAdapter(createCleanupQueue()),
    ],
    serverAdapter,
  });

  // Auth-gate ONLY this path — the rest of the app (GET /health) stays public.
  app.use(BULL_BOARD_PATH, bullBoardBasicAuth, serverAdapter.getRouter());

  const port = process.env.PORT ?? 4002;
  await app.listen(port);
   
  console.log(`apps/worker listening on port ${port} (Bull Board at ${BULL_BOARD_PATH})`);
}

bootstrap();
