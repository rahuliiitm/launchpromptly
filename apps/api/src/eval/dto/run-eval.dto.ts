import { IsString } from 'class-validator';

export class RunEvalDto {
  @IsString()
  promptVersionId!: string;
}
