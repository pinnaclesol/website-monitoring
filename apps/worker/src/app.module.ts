import { Module } from '@nestjs/common';
import { UptimePrismaModule } from '@uptime/uptime-db';
import { HealthController } from './health/health.controller';
import { ChecksModule } from './checks/checks.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { AlertsModule } from './alerts/alerts.module';
import { SignalSyncModule } from './signal-sync/signal-sync.module';

@Module({
  imports: [UptimePrismaModule, ChecksModule, CleanupModule, AlertsModule, SignalSyncModule],
  controllers: [HealthController],
})
export class AppModule {}
