import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { UptimePrismaModule } from '@uptime/uptime-db';
import { InternalApiKeyGuard } from './common/guards/internal-api-key.guard';
import { AuthModule } from './auth/auth.module';
import { SitesModule } from './sites/sites.module';
import { ChecksModule } from './checks/checks.module';
import { IncidentsModule } from './incidents/incidents.module';
import { SettingsModule } from './settings/settings.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // @Global() — imported once here, available to every module below.
    UptimePrismaModule,
    AuthModule,
    SitesModule,
    ChecksModule,
    IncidentsModule,
    SettingsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: InternalApiKeyGuard,
    },
  ],
})
export class AppModule {}
