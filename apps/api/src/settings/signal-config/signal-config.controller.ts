import { Body, Controller, Get, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SignalConfigService } from './signal-config.service';
import { UpsertSignalConfigDto } from './dto/upsert-signal-config.dto';

@Controller('settings/signal-config')
export class SignalConfigController {
  constructor(private readonly service: SignalConfigService) {}

  /**
   * `@Res()` (full manual control, not `passthrough`) on purpose: this is
   * the one route in the app whose "no config yet" state is a real `null`
   * value, not an empty array or an auto-created singleton row (unlike
   * AlertSettings/BrandingSettings, which always getOrCreate). NestJS's
   * default return-value handling collapses a handler returning `null`
   * into a genuinely empty HTTP body (0 bytes, not the 4-byte JSON text
   * "null") — the frontend's `res.json()` then throws "Unexpected end of
   * JSON input" trying to parse nothing. Calling `res.json()` ourselves
   * writes real JSON, `null` included, so the client always gets parseable
   * JSON matching the `SignalConfig | null` contract.
   */
  @Get()
  async findCurrent(@Res() res: Response): Promise<void> {
    const config = await this.service.findCurrent();
    res.status(200).json(config);
  }

  @Put()
  upsert(@Body() dto: UpsertSignalConfigDto) {
    return this.service.upsert(dto);
  }
}
