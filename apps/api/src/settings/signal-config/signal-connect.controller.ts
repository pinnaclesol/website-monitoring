import { Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SignalConnectService } from './signal-connect.service';
import { LinkQrCodeQueryDto } from './dto/link-qrcode-query.dto';

/**
 * "Connect Signal" QR-link flow, sharing the same `settings/signal-config`
 * controller prefix as `SignalConfigController` (sub-paths only) rather
 * than a separate top-level prefix.
 */
@Controller('settings/signal-config')
export class SignalConnectController {
  constructor(private readonly service: SignalConnectService) {}

  @Get('status')
  @RequirePermission('notifications:view')
  getStatus() {
    return this.service.getStatus();
  }

  @Get('link/qrcode')
  @RequirePermission('notifications:update')
  getLinkQrCode(@Query() query: LinkQrCodeQueryDto) {
    return this.service.getLinkQrCode(query.deviceName);
  }

  @Get('link/status')
  @RequirePermission('notifications:view')
  getLinkStatus() {
    return this.service.getLinkStatus();
  }

  @Get('groups')
  @RequirePermission('notifications:view')
  getGroups() {
    return this.service.getGroups();
  }

  // Enqueues a one-off job on the same queue the every-60s background sync
  // already runs on — apps/worker performs the actual sidecar call/cache
  // update, same producer/consumer split as monitors' manual "check now".
  @Post('groups/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('notifications:update')
  triggerGroupsSync() {
    return this.service.triggerGroupsSync();
  }

  @Post('test-send')
  @RequirePermission('notifications:update')
  testSend() {
    return this.service.testSend();
  }

  @Post('disconnect')
  @RequirePermission('notifications:update')
  disconnect() {
    return this.service.disconnect();
  }
}
