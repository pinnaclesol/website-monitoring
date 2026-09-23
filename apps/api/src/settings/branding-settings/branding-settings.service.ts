import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';

/** Singleton row: dashboard branding (site name, favicon/logo). Same app-enforced-singleton pattern as AlertSettings. */
@Injectable()
export class BrandingSettingsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async getOrCreate() {
    const existing = await this.prisma.brandingSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    // Default siteName ("Uptime Monitor") comes from the Prisma schema.
    return this.prisma.brandingSettings.create({ data: {} });
  }

  async update(dto: UpdateBrandingSettingsDto) {
    const current = await this.getOrCreate();
    return this.prisma.brandingSettings.update({
      where: { id: current.id },
      data: {
        ...(dto.siteName !== undefined ? { siteName: dto.siteName } : {}),
        ...(dto.faviconUrl !== undefined ? { faviconUrl: dto.faviconUrl || null } : {}),
      },
    });
  }
}
