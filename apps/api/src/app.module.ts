import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { UptimePrismaModule } from '@uptime/uptime-db';
import { InternalApiKeyGuard } from './common/guards/internal-api-key.guard';
import { PermissionGuard } from './common/guards/permission.guard';
import { AuthModule } from './auth/auth.module';
import { MonitorsModule } from './monitors/monitors.module';
import { ChecksModule } from './checks/checks.module';
import { IncidentsModule } from './incidents/incidents.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';
import { RolesModule } from './roles/roles.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // @Global() — imported once here, available to every module below.
    UptimePrismaModule,
    AuthModule,
    MonitorsModule,
    ChecksModule,
    IncidentsModule,
    SettingsModule,
    UsersModule,
    RolesModule,
  ],
  // HealthController lives directly here (not its own module) — mirrors
  // apps/worker/src/app.module.ts's exact pattern for the same route.
  controllers: [HealthController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalApiKeyGuard,
    },
    // Runs after InternalApiKeyGuard (registration order = execution order
    // for global guards): that guard is the coarse "is this apps/web at
    // all" check, this one is the finer per-user identity/permission check.
    {
      provide: APP_GUARD,
      useClass: PermissionGuard,
    },
  ],
})
export class AppModule {}
