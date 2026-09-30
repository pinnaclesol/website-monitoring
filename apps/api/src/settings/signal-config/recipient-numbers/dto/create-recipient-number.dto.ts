import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRecipientNumberDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
