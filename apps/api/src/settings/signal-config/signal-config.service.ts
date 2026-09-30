import { Injectable } from '@nestjs/common';
import type { Prisma } from '@uptime/uptime-db';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpsertSignalConfigDto } from './dto/upsert-signal-config.dto';

/**
 * Single config (not multi-account) — GET returns it or null, PUT upserts
 * it. This endpoint only ever manages `senderNumber`/`recipientGroupId`/
 * `recipientGroupName`/`isActive` — the fallback recipient number list
 * lives in `SignalRecipientNumber`, managed independently by
 * `recipient-numbers/`. A config with no group and no fallback numbers is a
 * perfectly valid (if non-functional-until-fixed) intermediate state, so
 * there's no "at least one recipient" validation here.
 */
@Injectable()
export class SignalConfigService {
  constructor(private readonly prisma: UptimePrismaService) {}

  findCurrent() {
    return this.prisma.signalConfig.findFirst({ orderBy: { createdAt: 'desc' } });
  }

  async upsert(dto: UpsertSignalConfigDto) {
    const existing = await this.findCurrent();
    const isActive = dto.isActive ?? true;

    // Only include a key in `data` when the DTO explicitly provided it, so an
    // `undefined` field never overwrites an existing stored value (Prisma
    // treats a key that's absent from `data` as "don't touch", but an
    // explicit `undefined` value assigned to a key behaves the same way too
    // — either way, omitting the key entirely is the clearest signal).
    const data: Prisma.SignalConfigUpdateInput = { senderNumber: dto.senderNumber, isActive };
    if (dto.recipientGroupId !== undefined) data.recipientGroupId = dto.recipientGroupId;
    if (dto.recipientGroupName !== undefined) data.recipientGroupName = dto.recipientGroupName;

    if (!existing) {
      return this.prisma.signalConfig.create({
        data: {
          senderNumber: dto.senderNumber,
          recipientGroupId: dto.recipientGroupId ?? null,
          recipientGroupName: dto.recipientGroupName ?? null,
          isActive,
        },
      });
    }

    return this.prisma.signalConfig.update({
      where: { id: existing.id },
      data,
    });
  }
}
