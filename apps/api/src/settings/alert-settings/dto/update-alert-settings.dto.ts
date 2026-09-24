import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateAlertSettingsDto {
  @IsOptional()
  @IsBoolean()
  recoveryAlertEnabled?: boolean;
}
