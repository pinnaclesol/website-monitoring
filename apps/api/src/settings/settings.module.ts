import { Module } from '@nestjs/common';
import { MonitorsModule } from '../monitors/monitors.module';
import { TelegramAccountsController } from './telegram-accounts/telegram-accounts.controller';
import { TelegramAccountsService } from './telegram-accounts/telegram-accounts.service';
import { SignalConfigController } from './signal-config/signal-config.controller';
import { SignalConfigService } from './signal-config/signal-config.service';
import { EmailRecipientsController } from './email-recipients/email-recipients.controller';
import { EmailRecipientsService } from './email-recipients/email-recipients.service';
import { SmtpConfigController } from './smtp-config/smtp-config.controller';
import { SmtpConfigService } from './smtp-config/smtp-config.service';
import { AlertSettingsController } from './alert-settings/alert-settings.controller';
import { AlertSettingsService } from './alert-settings/alert-settings.service';
import { MonitoringSettingsController } from './monitoring-settings/monitoring-settings.controller';
import { MonitoringSettingsService } from './monitoring-settings/monitoring-settings.service';
import { BrandingSettingsController } from './branding-settings/branding-settings.controller';
import { BrandingSettingsService } from './branding-settings/branding-settings.service';

@Module({
  // MonitoringSettingsService calls MonitorsService.rescheduleAllActive()
  // when the check interval changes.
  imports: [MonitorsModule],
  controllers: [
    TelegramAccountsController,
    SignalConfigController,
    EmailRecipientsController,
    SmtpConfigController,
    AlertSettingsController,
    MonitoringSettingsController,
    BrandingSettingsController,
  ],
  providers: [
    TelegramAccountsService,
    SignalConfigService,
    EmailRecipientsService,
    SmtpConfigService,
    AlertSettingsService,
    MonitoringSettingsService,
    BrandingSettingsService,
  ],
})
export class SettingsModule {}
