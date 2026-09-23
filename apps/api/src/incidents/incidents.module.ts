import { Module } from '@nestjs/common';
import { IncidentsController, MonitorIncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

@Module({
  controllers: [IncidentsController, MonitorIncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
