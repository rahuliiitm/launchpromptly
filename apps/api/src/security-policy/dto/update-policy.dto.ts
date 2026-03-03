import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PolicyRulesDto } from './create-policy.dto';

export class UpdatePolicyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => PolicyRulesDto)
  rules?: PolicyRulesDto;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
