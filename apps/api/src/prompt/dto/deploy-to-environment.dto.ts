import { IsString } from 'class-validator';

export class DeployToEnvironmentDto {
  @IsString()
  environmentId!: string;
}
