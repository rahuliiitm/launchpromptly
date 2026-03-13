import { IsOptional, IsString, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryFeedbackDto {
  @IsOptional()
  @IsString()
  @IsIn(['injection', 'jailbreak', 'pii', 'content'])
  guardrailType?: string;

  @IsOptional()
  @IsString()
  @IsIn(['correct', 'false_positive', 'false_negative'])
  feedback?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;
}
