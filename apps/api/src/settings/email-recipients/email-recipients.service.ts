import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { CreateEmailRecipientDto } from './dto/create-email-recipient.dto';
import { UpdateEmailRecipientDto } from './dto/update-email-recipient.dto';

@Injectable()
export class EmailRecipientsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.emailRecipient.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const recipient = await this.prisma.emailRecipient.findUnique({ where: { id } });
    if (!recipient) {
      throw new NotFoundException(`Email recipient ${id} not found`);
    }
    return recipient;
  }

  create(dto: CreateEmailRecipientDto) {
    return this.prisma.emailRecipient.create({ data: dto });
  }

  async update(id: string, dto: UpdateEmailRecipientDto) {
    await this.findOne(id);
    return this.prisma.emailRecipient.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.emailRecipient.delete({ where: { id } });
  }
}
