import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { MonitoringSettingsService } from './monitoring-settings.service';
import { UpdateMonitoringSettingsDto } from './dto/update-monitoring-settings.dto';

// Gated by settings:view/update, not monitors:*: this lives on the same
// Settings page as branding, and whoever can edit that page should be able
// to edit this too, without needing a separate monitors:update grant.
@Controller('settings/monitoring')
export class MonitoringSettingsController {
  constructor(private readonly service: MonitoringSettingsService) {}

  @Get()
  @RequirePermission('settings:view')
  getOrCreate() {
    return this.service.getOrCreate();
  }

  @Patch()
  @RequirePermission('settings:update')
  update(@Body() dto: UpdateMonitoringSettingsDto) {
    return this.service.update(dto);
  }
}
