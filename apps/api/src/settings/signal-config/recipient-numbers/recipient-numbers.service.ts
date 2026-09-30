import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { CreateRecipientNumberDto } from './dto/create-recipient-number.dto';
import { UpdateRecipientNumberDto } from './dto/update-recipient-number.dto';

@Injectable()
export class RecipientNumbersService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.signalRecipientNumber.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const recipient = await this.prisma.signalRecipientNumber.findUnique({ where: { id } });
    if (!recipient) {
      throw new NotFoundException(`Signal recipient number ${id} not found`);
    }
    return recipient;
  }

  create(dto: CreateRecipientNumberDto) {
    return this.prisma.signalRecipientNumber.create({ data: dto });
  }

  async update(id: string, dto: UpdateRecipientNumberDto) {
    await this.findOne(id);
    return this.prisma.signalRecipientNumber.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.signalRecipientNumber.delete({ where: { id } });
  }
}
