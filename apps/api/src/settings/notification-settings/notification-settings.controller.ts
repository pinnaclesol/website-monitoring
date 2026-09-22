import { Body, Controller, Get, Patch } from '@nestjs/common';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@Controller('settings/notifications')
export class NotificationSettingsController {
  constructor(private readonly service: NotificationSettingsService) {}

  @Get()
  getOrCreate() {
    return this.service.getOrCreate();
  }

  @Patch()
  update(@Body() dto: UpdateNotificationSettingsDto) {
    return this.service.update(dto);
  }
}
