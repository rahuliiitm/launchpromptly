import { IsString, IsIn } from 'class-validator';

export class UpdateMemberRoleDto {
  @IsString()
  @IsIn(['viewer', 'editor', 'lead'])
  role!: string;
}
