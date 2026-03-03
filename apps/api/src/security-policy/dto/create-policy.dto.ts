import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsArray,
  IsNumber,
  IsIn,
  MinLength,
  MaxLength,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── PII Configuration ──────────────────────────────────────────────────────

const PII_TYPES = [
  'email', 'phone', 'ssn', 'credit_card', 'ip_address', 'iban',
  'drivers_license', 'uk_nino', 'nhs_number', 'passport', 'aadhaar',
  'eu_phone', 'us_address', 'api_key', 'date_of_birth', 'medicare',
] as const;

const REDACTION_STRATEGIES = ['placeholder', 'mask', 'hash', 'none'] as const;

export class CustomPIIPatternDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  pattern!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence?: number;
}

export class PIIRulesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsIn(REDACTION_STRATEGIES)
  redaction?: string;

  @IsOptional()
  @IsArray()
  @IsIn(PII_TYPES, { each: true })
  types?: string[];

  @IsOptional()
  @IsBoolean()
  scanResponse?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomPIIPatternDto)
  customPatterns?: CustomPIIPatternDto[];
}

// ── Injection Configuration ────────────────────────────────────────────────

export class InjectionRulesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  blockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  blockOnHighRisk?: boolean;
}

// ── Cost Guard Configuration ───────────────────────────────────────────────

export class CostGuardRulesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostPerRequest?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostPerMinute?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostPerHour?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostPerDay?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxCostPerCustomer?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxTokensPerRequest?: number;

  @IsOptional()
  @IsBoolean()
  blockOnExceed?: boolean;
}

// ── Content Filter Configuration ───────────────────────────────────────────

const CONTENT_CATEGORIES = [
  'hate_speech', 'sexual', 'violence', 'self_harm', 'illegal',
] as const;

export class CustomContentPatternDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  pattern!: string;

  @IsIn(['warn', 'block'])
  severity!: string;
}

export class ContentFilterRulesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsIn(CONTENT_CATEGORIES, { each: true })
  categories?: string[];

  @IsOptional()
  @IsBoolean()
  blockOnViolation?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CustomContentPatternDto)
  customPatterns?: CustomContentPatternDto[];
}

// ── Model Policy Configuration ─────────────────────────────────────────────

export class ModelPolicyRulesDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedModels?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  blockedModels?: string[];
}

// ── Combined Rules ─────────────────────────────────────────────────────────

export class PolicyRulesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PIIRulesDto)
  pii?: PIIRulesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InjectionRulesDto)
  injection?: InjectionRulesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => CostGuardRulesDto)
  costGuard?: CostGuardRulesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContentFilterRulesDto)
  contentFilter?: ContentFilterRulesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ModelPolicyRulesDto)
  modelPolicy?: ModelPolicyRulesDto;
}

// ── Create Policy DTO ──────────────────────────────────────────────────────

export class CreatePolicyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsObject()
  @ValidateNested()
  @Type(() => PolicyRulesDto)
  rules!: PolicyRulesDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
