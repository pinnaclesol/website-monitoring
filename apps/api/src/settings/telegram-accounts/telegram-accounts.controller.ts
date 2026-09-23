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
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { TelegramAccountsService } from './telegram-accounts.service';
import { CreateTelegramAccountDto } from './dto/create-telegram-account.dto';
import { UpdateTelegramAccountDto } from './dto/update-telegram-account.dto';

@Controller('settings/telegram-accounts')
export class TelegramAccountsController {
  constructor(private readonly service: TelegramAccountsService) {}

  @Get()
  @RequirePermission('notifications:view')
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  @RequirePermission('notifications:view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('notifications:update')
  create(@Body() dto: CreateTelegramAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('notifications:update')
  update(@Param('id') id: string, @Body() dto: UpdateTelegramAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('notifications:update')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
