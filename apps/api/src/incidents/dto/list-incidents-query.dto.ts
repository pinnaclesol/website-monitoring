import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export type IncidentStatusFilter = 'all' | 'open' | 'recovered';

const STATUS_FILTERS: IncidentStatusFilter[] = ['all', 'open', 'recovered'];

export class ListIncidentsQueryDto {
  @IsOptional()
  @IsString()
  monitorId?: string;

  @IsOptional()
  @IsIn(STATUS_FILTERS)
  status?: IncidentStatusFilter = 'all';

  /** Matches against the incident's monitor's domain or label, case-insensitive. */
  @IsOptional()
  @IsString()
  search?: string;

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
}
