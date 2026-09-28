import { Injectable } from '@nestjs/common';
import { UptimePrismaService } from '@uptime/uptime-db';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';

/** Singleton row: dashboard branding — appName/appLogoUrl (sidebar) and siteTitle/faviconUrl (browser tab). Same app-enforced-singleton pattern as AlertSettings. */
@Injectable()
export class BrandingSettingsService {
  constructor(private readonly prisma: UptimePrismaService) {}

  async getOrCreate() {
    const existing = await this.prisma.brandingSettings.findFirst({ orderBy: { createdAt: 'asc' } });
    if (existing) return existing;
    // Defaults ("Uptime Monitor") come from the Prisma schema.
    return this.prisma.brandingSettings.create({ data: {} });
  }

  async update(dto: UpdateBrandingSettingsDto) {
    const current = await this.getOrCreate();
    return this.prisma.brandingSettings.update({
      where: { id: current.id },
      data: {
        ...(dto.appName !== undefined ? { appName: dto.appName } : {}),
        ...(dto.appLogoUrl !== undefined ? { appLogoUrl: dto.appLogoUrl || null } : {}),
        ...(dto.siteTitle !== undefined ? { siteTitle: dto.siteTitle } : {}),
        ...(dto.faviconUrl !== undefined ? { faviconUrl: dto.faviconUrl || null } : {}),
      },
    });
  }
}
