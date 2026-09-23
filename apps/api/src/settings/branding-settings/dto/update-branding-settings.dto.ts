import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateBrandingSettingsDto {
  /** Shown in the sidebar. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  appName?: string;

  /**
   * Sidebar logo mark. Not strictly URL-validated on purpose — this holds a
   * `/uploads/<file>` path from apps/web's local upload route, not an
   * arbitrary pasted URL. An empty string clears it back to the default
   * monitor glyph.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  appLogoUrl?: string;

  /** Browser tab `<title>`. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  siteTitle?: string;

  /**
   * Browser tab icon. Same non-URL-validated shape as `appLogoUrl` — a
   * `/uploads/<file>` path. An empty string clears it.
   */
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  faviconUrl?: string;
}
