import { IsString, IsNotEmpty, IsOptional, IsObject } from 'class-validator';

export class CreateIncidentDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  severity?: string; // 'low' | 'medium' | 'high' | 'critical'

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
