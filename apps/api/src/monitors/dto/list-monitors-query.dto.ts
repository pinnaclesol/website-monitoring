import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type MonitorStatusFilter = 'all' | 'up' | 'down' | 'paused' | 'checking';

const STATUS_FILTERS: MonitorStatusFilter[] = ['all', 'up', 'down', 'paused', 'checking'];

export class ListMonitorsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  /** Matches against domain or label, case-insensitive. */
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(STATUS_FILTERS)
  status?: MonitorStatusFilter = 'all';
}
