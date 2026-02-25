import { IsString, IsOptional, Matches, MaxLength } from 'class-validator';

export class CreateEnvironmentDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase alphanumeric with hyphens (e.g. "prod-us-east")',
  })
  slug!: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'color must be a hex color (e.g. "#059669")' })
  color?: string;
}
