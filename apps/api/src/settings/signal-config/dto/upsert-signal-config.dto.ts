import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpsertSignalConfigDto {
  @IsString()
  @IsNotEmpty()
  senderNumber!: string;

  @IsString()
  @IsNotEmpty()
  recipientNumber!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
