import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SetProviderKeyDto {
  @IsString()
  @MaxLength(500)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  label?: string;
}
