import { Module } from '@nestjs/common';
import { ChecksController, SiteChecksController } from './checks.controller';
import { ChecksService } from './checks.service';

@Module({
  controllers: [SiteChecksController, ChecksController],
  providers: [ChecksService],
})
export class ChecksModule {}
