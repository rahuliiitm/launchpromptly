import { IsString, IsInt, IsNumber, Min, IsIn } from 'class-validator';

const SENSITIVITY_PARAMETERS = [
  'projectedUsers',
  'subscriptionPrice',
  'requestsPerUser',
  'avgInputTokens',
  'avgOutputTokens',
] as const;

export class SensitivityDto {
  @IsString()
  @IsIn([...SENSITIVITY_PARAMETERS], {
    message: `parameter must be one of: ${SENSITIVITY_PARAMETERS.join(', ')}`,
  })
  parameter!: (typeof SENSITIVITY_PARAMETERS)[number];

  @IsInt()
  @Min(2)
  steps!: number;

  @IsNumber()
  @Min(0)
  rangeMin!: number;

  @IsNumber()
  @Min(0)
  rangeMax!: number;
}
