import { IsOptional, IsString, IsInt, Min, ValidateIf } from 'class-validator';
import { Type } from 'class-transformer';

export class DeleteEventsDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  olderThanDays?: number;
}
