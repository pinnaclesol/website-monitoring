import { Module } from '@nestjs/common';
import { ChecksController, MonitorChecksController } from './checks.controller';
import { ChecksService } from './checks.service';

@Module({
  controllers: [MonitorChecksController, ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
