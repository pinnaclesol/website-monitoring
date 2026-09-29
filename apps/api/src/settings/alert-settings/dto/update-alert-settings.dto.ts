import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(86400)
  repeatIntervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  recoveryAlertEnabled?: boolean;
}
