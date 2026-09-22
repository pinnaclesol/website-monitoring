import { Module } from '@nestjs/common';
import { AlertsService } from './alerts.service';

/** Owns the `alert-dispatch` BullMQ consumer (stub send logic for now). */
@Module({
  providers: [AlertsService],
})
export class AlertsModule {}
