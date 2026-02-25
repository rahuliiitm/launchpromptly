import { IsString, IsOptional } from 'class-validator';

export class AssignTeamDto {
  @IsOptional()
  @IsString()
  teamId!: string | null;
}
