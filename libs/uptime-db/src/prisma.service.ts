import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from './generated';

@Injectable()
export class UptimePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit()    { await this.$connect();    }
  async onModuleDestroy() { await this.$disconnect(); }
}
