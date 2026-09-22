import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateNotificationSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(30)
  alertIntervalSeconds?: number;

  @IsOptional()
  @IsBoolean()
  recoveryAlertEnabled?: boolean;
}
