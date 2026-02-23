import {
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class IngestEventDto {
  @IsString()
  @IsIn(['openai', 'anthropic'])
  provider!: string;

  @IsString()
  model!: string;

  @IsInt()
  @Min(0)
  inputTokens!: number;

  @IsInt()
  @Min(0)
  outputTokens!: number;

  @IsInt()
  @Min(0)
  totalTokens!: number;

  @IsNumber()
  @Min(0)
  costUsd!: number;

  @IsInt()
  @Min(0)
  latencyMs!: number;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  feature?: string;

  @IsOptional()
  @IsString()
  systemHash?: string;

  @IsOptional()
  @IsString()
  fullHash?: string;

  @IsOptional()
  @IsString()
  promptPreview?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  statusCode?: number;

  @IsOptional()
  @IsString()
  managedPromptId?: string;

  @IsOptional()
  @IsString()
  promptVersionId?: string;
}

export class IngestBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(100)
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}
