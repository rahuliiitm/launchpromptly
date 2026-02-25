import { IsString, IsOptional, MaxLength, IsNumber, Min, Max } from 'class-validator';

export class GenerateDatasetDto {
  @IsString()
  promptVersionId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  passThreshold?: number;
}
