import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Role } from '@uptime/auth';

const ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

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

  @IsIn(ROLES)
  role!: Role;
}
