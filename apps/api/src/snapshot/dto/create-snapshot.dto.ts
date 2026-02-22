import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateSnapshotDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;
}
