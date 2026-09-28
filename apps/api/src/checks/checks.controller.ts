import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChecksService } from './checks.service';
import { ListChecksQueryDto } from './dto/list-checks-query.dto';

@Controller('monitors/:monitorId/checks')
export class MonitorChecksController {
  constructor(private readonly checksService: ChecksService) {}

  @Get()
  findForMonitor(@Param('monitorId') monitorId: string, @Query() query: ListChecksQueryDto) {
    return this.checksService.findForMonitor(monitorId, query.limit);
  }
}

@Controller('checks')
export class ChecksController {
  constructor(private readonly checksService: ChecksService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.checksService.findOne(id);
  }
}
