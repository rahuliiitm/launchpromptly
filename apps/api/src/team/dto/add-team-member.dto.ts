import { IsString, IsOptional, IsIn } from 'class-validator';

export class AddTeamMemberDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsString()
  @IsIn(['viewer', 'editor', 'lead'])
  role?: string;
}
