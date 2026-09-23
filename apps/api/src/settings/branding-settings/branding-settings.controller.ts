import { Body, Controller, Get, Patch } from '@nestjs/common';
import { BrandingSettingsService } from './branding-settings.service';
import { UpdateBrandingSettingsDto } from './dto/update-branding-settings.dto';

@Controller('settings/branding')
export class BrandingSettingsController {
  constructor(private readonly service: BrandingSettingsService) {}

  @Get()
  getOrCreate() {
    return this.service.getOrCreate();
  }

  @Patch()
  update(@Body() dto: UpdateBrandingSettingsDto) {
    return this.service.update(dto);
  }
}
