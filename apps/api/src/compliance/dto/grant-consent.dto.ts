import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GrantConsentDto {
  @IsString()
  @IsNotEmpty()
  customerId!: string;

  @IsString()
  @IsNotEmpty()
  policyVersion!: string;

  @IsString()
  @IsOptional()
  purpose?: string;
}
