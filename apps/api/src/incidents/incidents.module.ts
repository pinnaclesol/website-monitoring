import { Module } from '@nestjs/common';
import { IncidentsController, SiteIncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  controllers: [IncidentsController, SiteIncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
