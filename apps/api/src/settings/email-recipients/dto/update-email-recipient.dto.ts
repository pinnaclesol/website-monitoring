import { IsBoolean, IsEmail, IsOptional } from 'class-validator';

export class UpdateEmailRecipientDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
