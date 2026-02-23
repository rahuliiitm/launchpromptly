import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
