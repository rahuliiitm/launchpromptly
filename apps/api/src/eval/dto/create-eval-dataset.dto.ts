import { IsString, MaxLength, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class CreateEvalDatasetDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  passThreshold?: number;
}
