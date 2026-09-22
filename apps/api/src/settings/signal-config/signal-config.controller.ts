import { Body, Controller, Get, Put } from '@nestjs/common';
import { SignalConfigService } from './signal-config.service';
import { UpsertSignalConfigDto } from './dto/upsert-signal-config.dto';

@Controller('settings/signal-config')
export class SignalConfigController {
  constructor(private readonly service: SignalConfigService) {}

  @Get()
  findCurrent() {
    return this.service.findCurrent();
  }

  @Put()
  upsert(@Body() dto: UpsertSignalConfigDto) {
    return this.service.upsert(dto);
  }
}
