import { Injectable, NotFoundException } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { CreateTelegramAccountDto } from './dto/create-telegram-account.dto';
import { UpdateTelegramAccountDto } from './dto/update-telegram-account.dto';

@Injectable()
export class TelegramAccountsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findAll() {
    return this.prisma.telegramAccount.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOne(id: string) {
    const account = await this.prisma.telegramAccount.findUnique({ where: { id } });
    if (!account) {
      throw new NotFoundException(`Telegram account ${id} not found`);
    }
    return account;
  }

  create(dto: CreateTelegramAccountDto) {
    return this.prisma.telegramAccount.create({ data: dto });
  }

  async update(id: string, dto: UpdateTelegramAccountDto) {
    await this.findOne(id);
    return this.prisma.telegramAccount.update({ where: { id }, data: dto });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.telegramAccount.delete({ where: { id } });
  }
}
