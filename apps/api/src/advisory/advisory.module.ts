import { Module } from '@nestjs/common';
import { AdvisoryService } from './advisory.service';
import { AdvisoryController } from './advisory.controller';

@Module({
  controllers: [AdvisoryController],
  providers: [AdvisoryService],
})
export class AdvisoryModule {}
