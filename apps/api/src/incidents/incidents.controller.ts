import { Controller, Get, Param, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { IncidentsService } from './incidents.service';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @RequirePermission('incidents:view')
  findAll(@Query() query: ListIncidentsQueryDto) {
    return this.incidentsService.findAll(query.monitorId, query.open);
  }

  @Get(':id')
  @RequirePermission('incidents:view')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }
}

@Controller('monitors/:monitorId/incidents')
export class MonitorIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  @RequirePermission('incidents:view')
  findForMonitor(@Param('monitorId') monitorId: string) {
    return this.incidentsService.findForMonitor(monitorId);
  }
}
