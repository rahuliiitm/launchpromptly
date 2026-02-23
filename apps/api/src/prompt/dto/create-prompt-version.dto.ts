import { IsString } from 'class-validator';

export class CreatePromptVersionDto {
  @IsString()
  content!: string;
}
