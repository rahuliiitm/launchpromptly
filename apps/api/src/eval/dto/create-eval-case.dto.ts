import { IsString, MaxLength, IsOptional, IsObject } from 'class-validator';

export class CreateEvalCaseDto {
  @IsString()
  @MaxLength(10000)
  input!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  expectedOutput?: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  criteria?: string;
}
