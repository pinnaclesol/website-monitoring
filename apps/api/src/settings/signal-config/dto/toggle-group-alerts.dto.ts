import { IsBoolean } from 'class-validator';

export class ToggleGroupAlertsDto {
  @IsBoolean()
  receiveAlerts!: boolean;
}
