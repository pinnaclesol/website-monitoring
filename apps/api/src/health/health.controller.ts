import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

/**
 * GET /api/health — liveness check for Docker/load-balancer healthchecks.
 * Mirrors apps/worker's own health.controller.ts. Must stay unauthenticated
 * (a healthcheck can't supply the internal API key) and dependency-free (no
 * DB/Redis calls here — this only proves the process itself is alive).
 */
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
