import { IsEmail, IsIn, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateInvitationDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsOptional()
  @IsIn(['admin', 'member'])
  role?: string;
}
