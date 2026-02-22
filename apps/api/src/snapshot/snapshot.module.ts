import { Module } from '@nestjs/common';
import { SnapshotService } from './snapshot.service';
import { SnapshotController, SnapshotCompareController } from './snapshot.controller';

@Module({
  controllers: [SnapshotCompareController, SnapshotController],
  providers: [SnapshotService],
})
export class SnapshotModule {}
