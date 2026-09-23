import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { MonitorsService } from './monitors.service';
import { CreateMonitorDto } from './dto/create-monitor.dto';
import { UpdateMonitorDto } from './dto/update-monitor.dto';

@Controller('monitors')
export class MonitorsController {
  constructor(private readonly monitorsService: MonitorsService) {}

  @Get()
  @RequirePermission('monitors:view')
  findAll() {
    return this.monitorsService.findAll();
  }

  @Get(':id')
  @RequirePermission('monitors:view')
  findOne(@Param('id') id: string) {
    return this.monitorsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('monitors:create')
  create(@Body() dto: CreateMonitorDto) {
    return this.monitorsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('monitors:update')
  update(@Param('id') id: string, @Body() dto: UpdateMonitorDto) {
    return this.monitorsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('monitors:delete')
  remove(@Param('id') id: string) {
    return this.monitorsService.remove(id);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('monitors:update')
  pause(@Param('id') id: string) {
    return this.monitorsService.pause(id);
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermission('monitors:update')
  resume(@Param('id') id: string) {
    return this.monitorsService.resume(id);
  }

  // Enqueues a one-off high-priority job on monitor-checks; apps/worker performs the actual check.
  @Post(':id/check-now')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('monitors:update')
  checkNow(@Param('id') id: string) {
    return this.monitorsService.checkNow(id);
  }
}
