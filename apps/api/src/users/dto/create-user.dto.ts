import { ArrayUnique, IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  // Display name shown in the UI instead of `username`. Optional — falls
  // back to `username` wherever it's unset.
  @IsOptional()
  @IsString()
  name?: string;

  // Never logged or returned — hashed with bcrypt before it touches the DB.
  // Max 72: bcrypt silently truncates beyond that, so anything longer would
  // let two different passwords collide on their shared 72-byte prefix.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  /** `Role.id` values to assign — a user can hold any number of roles; effective permissions are their union. */
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  roleIds!: string[];
}
