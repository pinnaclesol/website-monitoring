import { Module } from '@nestjs/common';
import { TelegramAccountsController } from './telegram-accounts/telegram-accounts.controller';
import { TelegramAccountsService } from './telegram-accounts/telegram-accounts.service';
import { SignalConfigController } from './signal-config/signal-config.controller';
import { SignalConfigService } from './signal-config/signal-config.service';
import { EmailRecipientsController } from './email-recipients/email-recipients.controller';
import { EmailRecipientsService } from './email-recipients/email-recipients.service';
import { NotificationSettingsController } from './notification-settings/notification-settings.controller';
import { NotificationSettingsService } from './notification-settings/notification-settings.service';

@Module({
  controllers: [
    TelegramAccountsController,
    SignalConfigController,
    EmailRecipientsController,
    NotificationSettingsController,
  ],
  providers: [
    TelegramAccountsService,
    SignalConfigService,
    EmailRecipientsService,
    NotificationSettingsService,
  ],
})
export class SettingsModule {}
