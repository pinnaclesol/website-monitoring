import { Module } from '@nestjs/common';
import { CleanupService } from './cleanup.service';

/** Owns the daily `cleanup` repeatable-job registration + its consumer. */
@Module({
  providers: [CleanupService],
})
export class CleanupModule {}
