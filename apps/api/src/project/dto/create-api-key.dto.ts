import { IsString, IsOptional, IsUUID, IsInt, MaxLength, Min, Max } from 'class-validator';

export class CreateApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUUID()
  environmentId?: string;

  /** Key expires after this many days. Omit for a non-expiring key. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  expiresInDays?: number;
}
