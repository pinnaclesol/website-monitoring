import { IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import type { Role } from '@uptime/auth';

const ROLES: Role[] = ['ADMIN', 'EDITOR', 'VIEWER'];

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  // Display name shown in the UI instead of `username`. Optional — falls
  // back to `username` wherever it's unset. Explicitly nullable: the
  // frontend sends `null` to clear a previously-set name back to that
  // fallback. `@IsOptional()` skips further validators for both `null` and
  // `undefined`.
  @IsOptional()
  @IsString()
  name?: string | null;

  // If provided, re-hashed the same way as create. Never logged or returned.
  // Max 72: bcrypt silently truncates beyond that (see create-user.dto.ts).
  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password?: string;

  @IsOptional()
  @IsIn(ROLES)
  role?: Role;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
