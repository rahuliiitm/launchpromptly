import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class CreateManagedPromptDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase with hyphens only (e.g. "customer-support")',
  })
  slug!: string;

  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  initialContent?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}
