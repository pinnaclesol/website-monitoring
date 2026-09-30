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
import { RequirePermission } from '../../../common/decorators/require-permission.decorator';
import { RecipientNumbersService } from './recipient-numbers.service';
import { CreateRecipientNumberDto } from './dto/create-recipient-number.dto';
import { UpdateRecipientNumberDto } from './dto/update-recipient-number.dto';

@Controller('settings/signal-config/recipient-numbers')
export class RecipientNumbersController {
  constructor(private readonly service: RecipientNumbersService) {}

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
  create(@Body() dto: CreateRecipientNumberDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('notifications:update')
  update(@Param('id') id: string, @Body() dto: UpdateRecipientNumberDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('notifications:update')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
