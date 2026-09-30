import { Module } from '@nestjs/common';
import { SignalGroupsSyncService } from './signal-groups-sync.service';

/** Owns the ~60s `signal-groups-sync` repeatable-job registration + its consumer. */
@Module({
  providers: [SignalGroupsSyncService],
})
export class SignalGroupsSyncModule {}
