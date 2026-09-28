import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** When provided, replaces the role's entire permission set (not a diff/patch). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  permissionIds?: string[];
}
