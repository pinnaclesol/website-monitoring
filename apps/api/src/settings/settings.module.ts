import { Module } from '@nestjs/common';
import { TelegramAccountsController } from './telegram-accounts/telegram-accounts.controller';
import { TelegramAccountsService } from './telegram-accounts/telegram-accounts.service';
import { SignalConfigController } from './signal-config/signal-config.controller';
import { SignalConfigService } from './signal-config/signal-config.service';
import { EmailRecipientsController } from './email-recipients/email-recipients.controller';
import { EmailRecipientsService } from './email-recipients/email-recipients.service';
import { AlertSettingsController } from './alert-settings/alert-settings.controller';
import { AlertSettingsService } from './alert-settings/alert-settings.service';
import { BrandingSettingsController } from './branding-settings/branding-settings.controller';
import { BrandingSettingsService } from './branding-settings/branding-settings.service';

@Module({
  controllers: [
    TelegramAccountsController,
    SignalConfigController,
    EmailRecipientsController,
    AlertSettingsController,
    BrandingSettingsController,
  ],
  providers: [
    TelegramAccountsService,
    SignalConfigService,
    EmailRecipientsService,
    AlertSettingsService,
    BrandingSettingsService,
  ],
})
export class SettingsModule {}
