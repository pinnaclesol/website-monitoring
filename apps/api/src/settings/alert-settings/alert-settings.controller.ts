import { Body, Controller, Get, Patch } from '@nestjs/common';
import { AlertSettingsService } from './alert-settings.service';
import { UpdateAlertSettingsDto } from './dto/update-alert-settings.dto';

@Controller('settings/alerts')
export class AlertSettingsController {
  constructor(private readonly service: AlertSettingsService) {}

  @Get()
  getOrCreate() {
    return this.service.getOrCreate();
  }

  @Patch()
  update(@Body() dto: UpdateAlertSettingsDto) {
    return this.service.update(dto);
  }
}
