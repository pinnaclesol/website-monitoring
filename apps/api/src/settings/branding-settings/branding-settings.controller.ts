import { Body, Controller, Get, Patch } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SkipPermissionCheck } from '../../common/decorators/skip-permission-check.decorator';
import { BrandingSettingsService } from './branding-settings.service';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';

@Controller('settings/branding')
export class BrandingSettingsController {
  constructor(private readonly service: BrandingSettingsService) {}

  // Not @RequirePermission('settings:view') — apps/web's root layout reads
  // this directly (not through the session-checked proxy) to render the
  // page title/favicon/sidebar branding on /login itself, before any
  // session/x-user-id exists. Branding is inherently pre-auth-visible
  // content, not sensitive data — still requires the internal API key.
  @Get()
  @SkipPermissionCheck()
  getOrCreate() {
    return this.service.getOrCreate();
  }

  @Patch()
  @RequirePermission('settings:update')
  update(@Body() dto: UpdateBrandingSettingsDto) {
    return this.service.update(dto);
  }
}
