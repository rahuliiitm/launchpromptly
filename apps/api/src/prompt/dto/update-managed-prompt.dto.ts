import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

export class UpdateManagedPromptDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase with hyphens only (e.g. "customer-support")',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
