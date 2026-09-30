import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SignalConfigService } from './signal-config.service';
import { ToggleGroupAlertsDto } from './dto/toggle-group-alerts.dto';

@Controller('settings/signal-config')
export class SignalConfigController {
  constructor(private readonly service: SignalConfigService) {}

  @Get()
  @RequirePermission('notifications:view')
  findAll() {
    return this.service.getAccounts();
  }

  @Get('accounts')
  @RequirePermission('notifications:view')
  getAccounts() {
    return this.service.getAccounts();
  }

  @Post('sync')
  @RequirePermission('notifications:update')
  sync() {
    return this.service.syncAccountsAndGroups();
  }

  @Patch('groups/:id/toggle')
  @RequirePermission('notifications:update')
  toggleGroup(@Param('id') id: string, @Body() dto: ToggleGroupAlertsDto) {
    return this.service.toggleGroupAlerts(id, dto.receiveAlerts);
  }

  @Delete('accounts/:phone')
  @RequirePermission('notifications:update')
  deleteAccount(@Param('phone') phone: string) {
    return this.service.deleteAccount(phone);
  }
}
