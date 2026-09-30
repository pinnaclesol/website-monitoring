import { IsOptional, IsString } from 'class-validator';

export class LinkQrCodeQueryDto {
  @IsOptional()
  @IsString()
  deviceName?: string;
}
