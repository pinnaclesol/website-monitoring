import { IsBoolean, IsEmail, IsOptional } from 'class-validator';

export class CreateEmailRecipientDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
