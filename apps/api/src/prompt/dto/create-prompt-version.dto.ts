import { IsString, MaxLength } from 'class-validator';

export class CreatePromptVersionDto {
  @IsString()
  @MaxLength(100000)
  content!: string;
}
