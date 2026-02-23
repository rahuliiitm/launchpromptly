import {
  IsString,
  IsArray,
  ValidateNested,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ABTestVariantDto {
  @IsString()
  promptVersionId!: string;

  @IsInt()
  @Min(1)
  @Max(100)
  trafficPercent!: number;
}

export class CreateABTestDto {
  @IsString()
  @MaxLength(200)
  name!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ABTestVariantDto)
  variants!: ABTestVariantDto[];
}
