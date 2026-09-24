import { Module } from '@nestjs/common';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';

@Module({
  controllers: [MonitorsController],
  providers: [MonitorsService],
  // SettingsModule's MonitoringSettingsService calls rescheduleAllActive()
  // when the global check interval changes.
  exports: [MonitorsService],
})
export class MonitorsModule {}
