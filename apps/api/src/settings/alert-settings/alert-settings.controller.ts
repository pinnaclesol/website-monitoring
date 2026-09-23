import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { AlertSettingsService } from './alert-settings.service';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';

@Controller('settings/alerts')
export class AlertSettingsController {
  constructor(private readonly service: AlertSettingsService) {}

  @Get()
  @RequirePermission('notifications:view')
  getOrCreate() {
    return this.service.getOrCreate();
  }

  @Patch()
  @RequirePermission('notifications:update')
  update(@Body() dto: UpdateAlertSettingsDto) {
    return this.service.update(dto);
  }
}
