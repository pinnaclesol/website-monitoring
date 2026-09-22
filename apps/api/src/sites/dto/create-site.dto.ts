import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  domain!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;
}
