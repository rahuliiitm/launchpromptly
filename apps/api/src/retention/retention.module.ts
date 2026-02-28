import { Module } from '@nestjs/common';
import { ProjectModule } from '../project/project.module';
import { AuditModule } from '../audit/audit.module';
import { RetentionController } from './retention.controller';
import { RetentionService } from './retention.service';

@Module({
  imports: [ProjectModule, AuditModule],
  controllers: [RetentionController],
  providers: [RetentionService],
  exports: [RetentionService],
})
export class RetentionModule {}
