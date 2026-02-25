import { IsString, IsOptional, IsBoolean, IsInt, Min, Matches, MaxLength } from 'class-validator';

export class UpdateEnvironmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color (e.g. "#059669")' })
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isCritical?: boolean;

  @IsOptional()
  @IsBoolean()
  evalGateEnabled?: boolean;
}
