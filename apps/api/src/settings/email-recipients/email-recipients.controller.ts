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
import { EmailRecipientsService } from './email-recipients.service';
import { CreateEmailRecipientDto } from './dto/create-email-recipient.dto';
import { UpdateEmailRecipientDto } from './dto/update-email-recipient.dto';

@Controller('settings/email-recipients')
export class EmailRecipientsController {
  constructor(private readonly service: EmailRecipientsService) {}

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
  create(@Body() dto: CreateEmailRecipientDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('notifications:update')
  update(@Param('id') id: string, @Body() dto: UpdateEmailRecipientDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('notifications:update')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
