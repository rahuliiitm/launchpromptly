import { IsString, IsNotEmpty, IsInt, IsNumber, Min, IsIn } from 'class-validator';
import { getSupportedModels } from '@aiecon/calculators';

export class CreateScenarioDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsIn(getSupportedModels(), {
    message: `model must be one of: ${getSupportedModels().join(', ')}`,
  })
  model!: string;

  @IsInt()
  @Min(0)
  avgInputTokens!: number;

  @IsInt()
  @Min(0)
  avgOutputTokens!: number;

  @IsInt()
  @Min(1)
  requestsPerUser!: number;

  @IsInt()
  @Min(1)
  projectedUsers!: number;

  @IsNumber()
  @Min(0)
  subscriptionPrice!: number;
}
