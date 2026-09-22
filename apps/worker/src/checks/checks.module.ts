import { Module } from '@nestjs/common';
import { ChecksService } from './checks.service';

/**
 * Owns the `site-checks` BullMQ consumer. `UptimePrismaService` is available
 * here via the `@Global()` `UptimePrismaModule` imported once in
 * `AppModule` — no need to re-import it.
 */
@Module({
  providers: [ChecksService],
})
export class ChecksModule {}
