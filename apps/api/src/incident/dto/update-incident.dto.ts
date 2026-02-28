import { IsString, IsOptional, IsObject } from 'class-validator';

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  severity?: string; // 'low' | 'medium' | 'high' | 'critical'

  @IsOptional()
  @IsString()
  status?: string; // 'open' | 'investigating' | 'resolved' | 'closed'

  @IsOptional()
  @IsString()
  source?: string; // 'auto' | 'manual'

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  assigneeId?: string;
}
