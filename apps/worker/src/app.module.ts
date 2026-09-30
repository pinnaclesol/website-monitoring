import { Module } from '@nestjs/common';
import { UptimePrismaModule } from '@uptime/uptime-db';
import { HealthController } from './health/health.controller';
import { ChecksModule } from './checks/checks.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { AlertsModule } from './alerts/alerts.module';
import { SignalGroupsSyncModule } from './signal/signal-groups-sync.module';

@Module({
  imports: [UptimePrismaModule, ChecksModule, CleanupModule, AlertsModule, SignalGroupsSyncModule],
  controllers: [HealthController],
})
export class AppModule {}
