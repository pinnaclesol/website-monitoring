import { Module } from '@nestjs/common';
import { SignalSyncService } from './signal-sync.service';

@Module({
  providers: [SignalSyncService],
  exports: [SignalSyncService],
})
export class SignalSyncModule {}
