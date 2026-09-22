import { Global, Module } from '@nestjs/common';
import { UptimePrismaService } from './prisma.service';

@Global()
@Module({
  providers: [UptimePrismaService],
  exports:   [UptimePrismaService],
})
export class UptimePrismaModule {}
