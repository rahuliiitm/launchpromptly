import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty({ message: 'DATABASE_URL is required' })
  DATABASE_URL!: string;

  @IsString()
  @IsNotEmpty({ message: 'JWT_SECRET is required' })
  JWT_SECRET!: string;

  @IsString()
  @IsNotEmpty({ message: 'ENCRYPTION_KEY is required for data-at-rest encryption' })
  ENCRYPTION_KEY!: string;

  @IsOptional()
  @IsString()
  API_PORT?: string;

  @IsOptional()
  @IsString()
  CORS_ORIGIN?: string;

  @IsOptional()
  @IsString()
  APP_URL?: string;

  @IsOptional()
  @IsString()
  NODE_ENV?: string;
}

export function validate(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const messages = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('\n  - ');
    throw new Error(
      `Environment validation failed:\n  - ${messages}\n\nSet the required variables in .env or your deployment config.`,
    );
  }

  return validated;
}
