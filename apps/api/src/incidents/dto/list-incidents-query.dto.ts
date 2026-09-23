import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsString()
  monitorId?: string;

  /** ?open=true — only currently-open incidents (endedAt = null). */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  open?: boolean;
}
