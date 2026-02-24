import { IsString, IsArray, ArrayMaxSize, MaxLength } from 'class-validator';

export class PlaygroundRequestDto {
  @IsString()
  @MaxLength(50000)
  systemPrompt!: string;

  @IsString()
  @MaxLength(10000)
  userMessage!: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  models!: string[];
}
