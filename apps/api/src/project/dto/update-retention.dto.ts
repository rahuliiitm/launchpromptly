import { IsInt, Min, Max } from 'class-validator';

export class UpdateRetentionDto {
  @IsInt()
  @Min(1)
  @Max(365)
  retentionDays!: number;
}
