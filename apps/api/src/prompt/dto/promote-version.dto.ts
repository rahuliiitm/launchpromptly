import { IsString } from 'class-validator';

export class PromoteVersionDto {
  @IsString()
  sourceEnvironmentId!: string;

  @IsString()
  targetEnvironmentId!: string;
}
