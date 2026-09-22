import { Controller, Get, Param, Query } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { ListIncidentsQueryDto } from './dto/list-incidents-query.dto';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findAll(@Query() query: ListIncidentsQueryDto) {
    return this.incidentsService.findAll(query.siteId, query.open);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }
}

@Controller('sites/:siteId/incidents')
export class SiteIncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  findForSite(@Param('siteId') siteId: string) {
    return this.incidentsService.findForSite(siteId);
  }
}
