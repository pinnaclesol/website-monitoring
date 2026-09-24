import { IsBoolean, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class UpsertSmtpConfigDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host!: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  port!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  /** Omitted/blank keeps the existing password — same UX as editing a User's password. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  password?: string;

  @IsEmail()
  @MaxLength(255)
  fromEmail!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
