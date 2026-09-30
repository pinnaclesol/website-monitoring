import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateRecipientNumberDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
