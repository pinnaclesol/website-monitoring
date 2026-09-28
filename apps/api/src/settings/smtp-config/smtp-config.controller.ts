import { Body, Controller, Get, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SmtpConfigService } from './smtp-config.service';
import { UpsertSmtpConfigDto } from './dto/upsert-smtp-config.dto';

@Controller('settings/smtp-config')
export class SmtpConfigController {
  constructor(private readonly service: SmtpConfigService) {}

  /**
   * `@Res()` (full manual control, not `passthrough`) — same reason as
   * SignalConfigController: "no config yet" is a real `null` value here,
   * and NestJS's default handling collapses a handler returning `null`
   * into a genuinely empty HTTP body, which breaks the frontend's
   * `res.json()` parse. Calling `res.json()` ourselves always writes real,
   * parseable JSON.
   */
  @Get()
  @RequirePermission('notifications:view')
  async findCurrent(@Res() res: Response): Promise<void> {
    const config = await this.service.findCurrent();
    res.status(200).json(config);
  }

  @Put()
  @RequirePermission('notifications:update')
  upsert(@Body() dto: UpsertSmtpConfigDto) {
    return this.service.upsert(dto);
  }
}
