import { Controller, Get } from '@nestjs/common';

/**
 * GET /health — the only public route besides Bull Board's auth-gated
 * /admin/queues. Used for ops/load-balancer liveness checks, so it must stay
 * unauthenticated and dependency-free (no DB/Redis calls here).
 */
@Controller('health')
export class HealthController {
  @Get()
  check(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
