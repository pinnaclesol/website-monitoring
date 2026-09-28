import { ArrayUnique, IsArray, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  /** `Permission.id` values to grant this role — an empty array is a valid (inert) role. */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  permissionIds!: string[];
}
