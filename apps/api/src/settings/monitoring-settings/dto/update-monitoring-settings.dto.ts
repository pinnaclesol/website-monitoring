import { IsInt, Max, Min } from 'class-validator';

export class UpdateMonitoringSettingsDto {
  // 30s floor keeps check load sane; 3600s (1h) ceiling keeps "uptime
  // monitor" meaningfully live.
  @IsInt()
  @Min(30)
  @Max(3600)
  checkIntervalSeconds!: number;
}
