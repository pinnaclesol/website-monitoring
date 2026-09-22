import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChecksService } from './checks.service';
import { ListChecksQueryDto } from './dto/list-checks-query.dto';

@Controller('sites/:siteId/checks')
export class SiteChecksController {
  constructor(private readonly checksService: ChecksService) {}

  @Get()
  findForSite(@Param('siteId') siteId: string, @Query() query: ListChecksQueryDto) {
    return this.checksService.findForSite(siteId, query.limit);
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
