import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  MaxLength,
} from 'class-validator';

export class SubmitFeedbackDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['injection', 'jailbreak', 'pii', 'content'])
  guardrailType!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['allow', 'warn', 'block'])
  originalAction!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['correct', 'false_positive', 'false_negative'])
  feedback!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
