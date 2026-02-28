import {
  IsArray,
  ValidateNested,
  IsString,
  IsInt,
  IsNumber,
  IsOptional,
  IsIn,
  IsObject,
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

  @IsOptional()
  @IsString()
  ragPipelineId?: string;

  @IsOptional()
  @IsString()
  ragQuery?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  ragRetrievalMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ragChunkCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  ragContextTokens?: number;

  @IsOptional()
  @IsArray()
  ragChunks?: Array<{ content: string; source: string; score: number; metadata?: Record<string, unknown> }>;

  @IsOptional()
  @IsString()
  responseText?: string;

  @IsOptional()
  @IsString()
  traceId?: string;

  @IsOptional()
  @IsString()
  spanName?: string;

  @IsOptional()
  @IsString()
  environmentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, string>;

  // Security metadata from SDK
  @IsOptional()
  @IsObject()
  piiDetections?: {
    inputCount: number;
    outputCount: number;
    types: string[];
    redactionApplied: boolean;
    detectorUsed: string;
  };

  @IsOptional()
  @IsObject()
  injectionRisk?: {
    score: number;
    triggered: string[];
    action: string;
    detectorUsed: string;
  };

  @IsOptional()
  @IsObject()
  costGuard?: {
    estimatedCost: number;
    budgetRemaining: number;
    limitTriggered?: string;
  };

  @IsOptional()
  @IsObject()
  contentViolations?: {
    inputViolations: Array<{ category: string; matched: string; severity: string }>;
    outputViolations: Array<{ category: string; matched: string; severity: string }>;
  };

  @IsOptional()
  @IsObject()
  compliance?: {
    consentRecorded: boolean;
    dataRegion?: string;
    retentionDays?: number;
  };
}

export class IngestBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMaxSize(100)
  @Type(() => IngestEventDto)
  events!: IngestEventDto[];
}
