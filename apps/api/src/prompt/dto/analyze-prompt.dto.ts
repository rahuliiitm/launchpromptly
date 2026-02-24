import { IsString, IsOptional, MaxLength } from 'class-validator';

export class AnalyzePromptDto {
  @IsString()
  @MaxLength(50000)
  content!: string;

  @IsOptional()
  @IsString()
  model?: string;
}
