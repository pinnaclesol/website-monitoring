import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export class UpsertSignalConfigDto {
  @IsString()
  @IsNotEmpty()
  senderNumber!: string;

  /**
   * Optional-and-nullable: omitted means "don't change this field", an
   * explicit `null` means "clear the group selection and revert to
   * number-only". `@ValidateIf` skips the `@IsString()` check when the
   * value is exactly `null` so that case still validates cleanly.
   */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  recipientGroupId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  recipientGroupName?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
