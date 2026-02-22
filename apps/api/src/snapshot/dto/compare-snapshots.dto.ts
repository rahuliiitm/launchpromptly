import { IsArray, IsUUID, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class CompareSnapshotsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMinSize(2)
  @ArrayMaxSize(4)
  snapshotIds!: string[];
}
