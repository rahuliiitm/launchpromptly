import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsObject,
  IsUrl,
} from 'class-validator';

export class CreateAlertRuleDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsObject()
  condition!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsUrl()
  webhookUrl?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsNumber()
  throttleMinutes?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
