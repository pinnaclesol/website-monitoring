import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTelegramAccountDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  // Secret — never logged or returned in a way that leaks server-side; fine
  // to return to the (single, authenticated) dashboard admin in this response.
  @IsString()
  @IsNotEmpty()
  botToken!: string;

  @IsString()
  @IsNotEmpty()
  chatId!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
