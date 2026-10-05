import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateMonitoringSettingsDto {
  // 30s floor keeps check load sane; 3600s (1h) ceiling keeps "uptime
  // monitor" meaningfully live.
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(3600)
  checkIntervalSeconds?: number;

  // Must stay well under the check interval's 30s floor so one attempt
  // can't overlap the next scheduled check.
  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(30)
  timeoutSeconds?: number;

  /** Display-only "slow" threshold — never triggers an alert. */
  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(60_000)
  slowThresholdMs?: number;

  /** Total attempts before a failure is confirmed (1 = no retry). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  retryAttempts?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  retryDelaySeconds?: number;
}
