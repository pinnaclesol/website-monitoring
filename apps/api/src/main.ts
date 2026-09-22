import * as path from 'path';
import * as dotenv from 'dotenv';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  // This workspace uses ONE root .env for every app (not a per-app .env) —
  // see CLAUDE.md's Environment Setup section. Runs before NestFactory.create
  // instantiates any provider (e.g. SitesService's @uptime/queue field
  // initializer reads REDIS_URL), which is all that matters here — nothing
  // above this line reads process.env at import time, only at instantiation
  // time. `../../../.env` resolves to the repo root from both this file's
  // dev location (apps/api/src) and the webpack-bundled prod output
  // (dist/apps/api) — both are three directories deep from the repo root.
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

  const app = await NestFactory.create(AppModule);

  // apps/web is the only intended caller. This app should not be directly
  // internet-exposed — CORS here is a dev-time safety net, not the primary
  // access control (the internal API key guard is).
  app.enableCors({
    origin: 'http://localhost:4000',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = process.env.PORT ?? 4001;
  await app.listen(port);
}

bootstrap();
