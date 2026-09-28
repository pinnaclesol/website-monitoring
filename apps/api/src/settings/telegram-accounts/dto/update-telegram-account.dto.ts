import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTelegramAccountDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  botToken?: string;

  @IsOptional()
  @IsString()
  chatId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
