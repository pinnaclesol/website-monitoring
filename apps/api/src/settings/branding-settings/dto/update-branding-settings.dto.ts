import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBrandingSettingsDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteName?: string;

  /**
   * Not strictly URL-validated on purpose — a relative path or a `data:`
   * URI are both legitimate values here, not just `https://...`. An empty
   * string clears it back to the default monitor-glyph icon.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  faviconUrl?: string;
}
